-- =============================================================================
-- HireFlow AI — Recruitment Intelligence Platform
-- Migration: Hiring Intelligence core schema
--
-- Architecture:
--   Providers → hiring_signals (source of truth)
--   hiring_signals → companies (derived updates only)
--   hiring_signals → vacancies, contacts (when applicable)
--   company_scores, ai_summaries (versioned intelligence artifacts)
--   outreach, tasks (action layer)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUM-like constraints (text + check for migration flexibility)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 2. Companies — intelligence metadata columns
-- -----------------------------------------------------------------------------
alter table public.companies
  add column if not exists owner_id uuid references public.profiles (id) on delete set null,
  add column if not exists sector text,
  add column if not exists city text,
  add column if not exists notes text,
  add column if not exists last_signal_at timestamptz,
  add column if not exists signal_count integer not null default 0,
  add column if not exists hiring_intensity integer not null default 0
    check (hiring_intensity >= 0 and hiring_intensity <= 100);

comment on column public.companies.lead_score is 'DEPRECATED: use company_scores.is_current';
comment on column public.companies.priority is 'DEPRECATED: use company_scores.priority';
comment on column public.companies.score_reason is 'DEPRECATED: use company_scores.score_reason';
comment on column public.companies.score_breakdown is 'DEPRECATED: use company_scores.score_breakdown';
comment on column public.companies.hiring_signals is 'DEPRECATED: use hiring_signals table';
comment on column public.companies.ai_summary is 'DEPRECATED: use ai_summaries table';
comment on column public.companies.vacancy_count is 'DEPRECATED: derive from vacancies / hiring_signals';

create index if not exists companies_org_last_signal_idx
  on public.companies (organization_id, last_signal_at desc nulls last);

create index if not exists companies_org_hiring_intensity_idx
  on public.companies (organization_id, hiring_intensity desc);

create index if not exists companies_org_domain_idx
  on public.companies (organization_id, domain)
  where domain is not null;

-- pg_trgm for fuzzy company search
create extension if not exists pg_trgm;

create index if not exists companies_org_name_trgm_idx
  on public.companies using gin (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 3. hiring_signals — central intelligence entity
-- -----------------------------------------------------------------------------
create table if not exists public.hiring_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  job_id uuid references public.company_search_jobs (id) on delete set null,

  provider text not null check (
    provider in (
      'brave_search', 'google_maps', 'google_cse', 'serpapi', 'bing_search',
      'firecrawl', 'indeed', 'werkenbij', 'linkedin', 'nationale_vacaturebank',
      'native_crawler', 'http_fetch', 'playwright', 'manual', 'legacy'
    )
  ),
  signal_type text not null check (
    signal_type in (
      'company_discovered', 'vacancy_detected', 'careers_page_found',
      'hiring_page_found', 'linkedin_company_found', 'contact_discovered',
      'website_enriched', 'email_found', 'phone_found', 'location_confirmed',
      'sector_hint', 'employee_count_hint', 'kvk_found', 'hiring_activity',
      'maps_listing', 'indeed_listing', 'werkenbij_listing'
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'processed', 'merged', 'duplicate', 'rejected', 'failed')
  ),

  external_id text,
  source_url text,
  fingerprint text not null,

  title text,
  description text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),

  payload jsonb not null default '{}'::jsonb,
  extracted_fields jsonb not null default '{}'::jsonb,

  observed_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, fingerprint)
);

create index if not exists hiring_signals_org_company_observed_idx
  on public.hiring_signals (organization_id, company_id, observed_at desc);

create index if not exists hiring_signals_org_provider_type_idx
  on public.hiring_signals (organization_id, provider, signal_type);

create index if not exists hiring_signals_org_status_pending_idx
  on public.hiring_signals (organization_id, created_at desc)
  where status in ('pending', 'processing');

create index if not exists hiring_signals_job_idx
  on public.hiring_signals (job_id)
  where job_id is not null;

create index if not exists hiring_signals_org_observed_idx
  on public.hiring_signals (organization_id, observed_at desc);

alter table public.hiring_signals enable row level security;

do $policy$
begin
  execute $sql$
    create policy "hiring_signals_tenant"
    on public.hiring_signals
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

-- -----------------------------------------------------------------------------
-- 4. company_scores — versioned hiring scores
-- -----------------------------------------------------------------------------
create table if not exists public.company_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,

  score integer not null check (score >= 0 and score <= 100),
  priority text check (priority in ('A', 'B', 'C')),
  score_reason text,
  score_breakdown jsonb not null default '{}'::jsonb,

  model_version text not null default 'v1',
  signal_count integer not null default 0,
  contributing_signal_ids uuid[] not null default '{}',

  computed_at timestamptz not null default now(),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists company_scores_current_unique_idx
  on public.company_scores (organization_id, company_id)
  where is_current = true;

create index if not exists company_scores_org_score_idx
  on public.company_scores (organization_id, score desc);

create index if not exists company_scores_company_history_idx
  on public.company_scores (company_id, computed_at desc);

alter table public.company_scores enable row level security;

do $policy$
begin
  execute $sql$
    create policy "company_scores_tenant"
    on public.company_scores
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

alter table public.companies
  add column if not exists current_score_id uuid references public.company_scores (id) on delete set null;

-- -----------------------------------------------------------------------------
-- 5. ai_summaries — versioned AI intelligence
-- -----------------------------------------------------------------------------
create table if not exists public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,

  summary_type text not null check (
    summary_type in ('recruitment_brief', 'classification', 'outreach_angle', 'hiring_analysis')
  ),
  content text not null,
  model text,
  model_version text,
  metadata jsonb not null default '{}'::jsonb,

  generated_at timestamptz not null default now(),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_summaries_current_unique_idx
  on public.ai_summaries (organization_id, company_id, summary_type)
  where is_current = true;

create index if not exists ai_summaries_company_idx
  on public.ai_summaries (company_id, generated_at desc);

alter table public.ai_summaries enable row level security;

do $policy$
begin
  execute $sql$
    create policy "ai_summaries_tenant"
    on public.ai_summaries
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

alter table public.companies
  add column if not exists current_summary_id uuid references public.ai_summaries (id) on delete set null;

-- -----------------------------------------------------------------------------
-- 6. outreach — action layer (migrate from outreach_queue)
-- -----------------------------------------------------------------------------
create table if not exists public.outreach (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  ai_summary_id uuid references public.ai_summaries (id) on delete set null,
  hiring_signal_id uuid references public.hiring_signals (id) on delete set null,

  status text not null default 'draft' check (
    status in ('draft', 'review', 'approved', 'sent', 'cancelled', 'blocked', 'queued')
  ),
  suggested_contact_role text,
  outreach_angle text,
  message_subject text,
  message_body text,
  review_required boolean not null default true,
  scheduled_at timestamptz,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outreach_active_company_idx
  on public.outreach (organization_id, company_id)
  where status in ('draft', 'review', 'approved', 'queued');

create index if not exists outreach_org_status_idx
  on public.outreach (organization_id, status);

create index if not exists outreach_company_idx
  on public.outreach (company_id, created_at desc);

alter table public.outreach enable row level security;

do $policy$
begin
  execute $sql$
    create policy "outreach_tenant"
    on public.outreach
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

-- Migrate outreach_queue → outreach (idempotent)
do $migrate_outreach$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'outreach_queue'
  ) then
    insert into public.outreach (
      id, organization_id, company_id, user_id, status,
      suggested_contact_role, outreach_angle, review_required, created_at, updated_at
    )
    select
      oq.id,
      oq.organization_id,
      oq.company_id,
      oq.user_id,
      case oq.status
        when 'approved' then 'approved'
        when 'sent' then 'sent'
        when 'cancelled' then 'cancelled'
        when 'blocked' then 'blocked'
        else oq.status
      end,
      oq.suggested_contact_role,
      oq.outreach_angle,
      oq.review_required,
      oq.created_at,
      oq.updated_at
    from public.outreach_queue oq
    where not exists (select 1 from public.outreach o where o.id = oq.id);
  end if;
end
$migrate_outreach$;

-- Backward-compatible view for legacy code
create or replace view public.outreach_queue_compat as
select
  id,
  organization_id,
  company_id,
  user_id,
  status,
  suggested_contact_role,
  outreach_angle,
  review_required,
  created_at,
  updated_at
from public.outreach;

-- -----------------------------------------------------------------------------
-- 7. vacancies — link to hiring signals
-- -----------------------------------------------------------------------------
alter table public.vacancies
  add column if not exists hiring_signal_id uuid references public.hiring_signals (id) on delete set null,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists detected_at timestamptz,
  add column if not exists is_relevant boolean not null default false,
  add column if not exists external_id text;

create index if not exists vacancies_company_detected_idx
  on public.vacancies (company_id, detected_at desc nulls last);

create index if not exists vacancies_hiring_signal_idx
  on public.vacancies (hiring_signal_id)
  where hiring_signal_id is not null;

create unique index if not exists vacancies_org_external_unique_idx
  on public.vacancies (organization_id, company_id, external_id)
  where external_id is not null;

-- -----------------------------------------------------------------------------
-- 8. contacts — link to hiring signals
-- -----------------------------------------------------------------------------
alter table public.contacts
  add column if not exists hiring_signal_id uuid references public.hiring_signals (id) on delete set null,
  add column if not exists source_provider text,
  add column if not exists external_id text;

create index if not exists contacts_hiring_signal_idx
  on public.contacts (hiring_signal_id)
  where hiring_signal_id is not null;

-- -----------------------------------------------------------------------------
-- 9. tasks — extend related entities
-- -----------------------------------------------------------------------------
do $tasks_align$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'related_type'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = 'related_entity_type'
    ) then
      alter table public.tasks rename column related_entity_type to related_type;
    else
      alter table public.tasks add column related_type text;
    end if;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'related_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = 'related_entity_id'
    ) then
      alter table public.tasks rename column related_entity_id to related_id;
    else
      alter table public.tasks add column related_id uuid;
    end if;
  end if;
end
$tasks_align$;

alter table public.tasks drop constraint if exists tasks_related_type_check;

alter table public.tasks
  add constraint tasks_related_type_check check (
    related_type is null or related_type in (
      'company', 'contact', 'candidate', 'vacancy', 'hiring_signal', 'outreach'
    )
  );

alter table public.tasks
  add column if not exists priority text not null default 'medium';

do $tasks_priority_check$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_priority_check'
  ) then
    alter table public.tasks
      add constraint tasks_priority_check
      check (priority in ('low', 'medium', 'high', 'urgent'));
  end if;
exception
  when others then null;
end
$tasks_priority_check$;

do $tasks_index$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'organization_id'
  ) then
    execute 'create index if not exists tasks_org_status_due_idx on public.tasks (organization_id, status, due_at nulls last)';
  end if;
end
$tasks_index$;

-- -----------------------------------------------------------------------------
-- 10. Signal → Company projection function
-- -----------------------------------------------------------------------------
create or replace function public.apply_hiring_signal_to_company(p_signal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signal public.hiring_signals%rowtype;
  v_fields jsonb;
  v_conf numeric;
begin
  select * into v_signal
  from public.hiring_signals
  where id = p_signal_id;

  if not found or v_signal.company_id is null then
    return;
  end if;

  v_fields := coalesce(v_signal.extracted_fields, '{}'::jsonb);
  v_conf := coalesce(v_signal.confidence, 0.5);

  update public.companies c
  set
    name = coalesce(nullif(v_fields->>'name', ''), c.name),
    website = case when v_fields ? 'website' then nullif(v_fields->>'website', '') else c.website end,
    domain = case when v_fields ? 'domain' then nullif(v_fields->>'domain', '') else c.domain end,
    linkedin_url = case when v_fields ? 'linkedin_url' then nullif(v_fields->>'linkedin_url', '') else c.linkedin_url end,
    email = case when v_fields ? 'email' then nullif(v_fields->>'email', '') else c.email end,
    general_email = case when v_fields ? 'general_email' then nullif(v_fields->>'general_email', '') else c.general_email end,
    hr_email = case when v_fields ? 'hr_email' then nullif(v_fields->>'hr_email', '') else c.hr_email end,
    phone = case when v_fields ? 'phone' then nullif(v_fields->>'phone', '') else c.phone end,
    sector = case when v_fields ? 'sector' then nullif(v_fields->>'sector', '') else c.sector end,
    city = case when v_fields ? 'city' then nullif(v_fields->>'city', '') else c.city end,
    region = case when v_fields ? 'region' then nullif(v_fields->>'region', '') else c.region end,
    province = case when v_fields ? 'province' then nullif(v_fields->>'province', '') else c.province end,
    country = case when v_fields ? 'country' then nullif(v_fields->>'country', '') else c.country end,
    careers_url = case when v_fields ? 'careers_url' then nullif(v_fields->>'careers_url', '') else c.careers_url end,
    vacancy_page_url = case when v_fields ? 'vacancy_page_url' then nullif(v_fields->>'vacancy_page_url', '') else c.vacancy_page_url end,
    kvk_number = case when v_fields ? 'kvk_number' then nullif(v_fields->>'kvk_number', '') else c.kvk_number end,
    employee_count_min = case
      when v_fields ? 'employee_count_min' then (v_fields->>'employee_count_min')::integer
      else c.employee_count_min
    end,
    employee_count_max = case
      when v_fields ? 'employee_count_max' then (v_fields->>'employee_count_max')::integer
      else c.employee_count_max
    end,
    source = coalesce(nullif(v_fields->>'source', ''), c.source, v_signal.provider),
    source_url = coalesce(nullif(v_signal.source_url, ''), c.source_url),
    confidence = greatest(coalesce(c.confidence, 0), v_conf),
    last_verified_at = greatest(coalesce(c.last_verified_at, v_signal.observed_at), v_signal.observed_at),
    last_signal_at = greatest(coalesce(c.last_signal_at, v_signal.observed_at), v_signal.observed_at),
    signal_count = c.signal_count + 1,
    hiring_intensity = least(
      100,
      c.hiring_intensity + case
        when v_signal.signal_type in ('vacancy_detected', 'hiring_activity', 'indeed_listing', 'werkenbij_listing') then 15
        when v_signal.signal_type in ('careers_page_found', 'hiring_page_found') then 10
        else 3
      end
    ),
    updated_at = now()
  where c.id = v_signal.company_id;

  update public.hiring_signals
  set status = 'processed', processed_at = now(), updated_at = now()
  where id = p_signal_id and status <> 'processed';
end;
$$;

create or replace function public.trg_apply_hiring_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is not null and new.status in ('pending', 'processing', 'processed') then
    perform public.apply_hiring_signal_to_company(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists hiring_signals_apply_company on public.hiring_signals;

create trigger hiring_signals_apply_company
  after insert or update of company_id, extracted_fields, status
  on public.hiring_signals
  for each row
  execute function public.trg_apply_hiring_signal();

-- -----------------------------------------------------------------------------
-- 11. Backfill: companies.hiring_signals jsonb → hiring_signals rows
-- -----------------------------------------------------------------------------
insert into public.hiring_signals (
  organization_id,
  company_id,
  provider,
  signal_type,
  title,
  description,
  confidence,
  payload,
  extracted_fields,
  fingerprint,
  status,
  observed_at,
  processed_at
)
select
  c.organization_id,
  c.id,
  coalesce(
    case
      when sig->>'source' ilike '%indeed%' then 'indeed'
      when sig->>'source' ilike '%linkedin%' then 'linkedin'
      when sig->>'source' ilike '%werkenbij%' or sig->>'source' ilike '%werken-bij%' then 'werkenbij'
      when sig->>'source' ilike '%firecrawl%' then 'firecrawl'
      when sig->>'source' ilike '%brave%' then 'brave_search'
      when sig->>'source' ilike '%maps%' then 'google_maps'
      else 'legacy'
    end,
    'legacy'
  ),
  coalesce(nullif(sig->>'type', ''), 'hiring_activity'),
  left(sig->>'description', 500),
  sig->>'description',
  coalesce((sig->>'confidence')::numeric, 0.5),
  sig,
  jsonb_build_object('description', sig->>'description', 'source', sig->>'source'),
  encode(
    sha256(
      (c.organization_id::text || ':' || c.id::text || ':' || coalesce(sig->>'type', '') || ':' || coalesce(sig->>'description', ''))::bytea
    ),
    'hex'
  ),
  'processed',
  coalesce(c.last_verified_at, c.updated_at, c.created_at),
  coalesce(c.last_verified_at, c.updated_at, c.created_at)
from public.companies c
cross join lateral jsonb_array_elements(coalesce(c.hiring_signals, '[]'::jsonb)) as sig
where c.organization_id is not null
  and jsonb_array_length(coalesce(c.hiring_signals, '[]'::jsonb)) > 0
on conflict (organization_id, fingerprint) do nothing;

-- Backfill: lead_score → company_scores
insert into public.company_scores (
  organization_id,
  company_id,
  score,
  priority,
  score_reason,
  score_breakdown,
  signal_count,
  computed_at,
  is_current
)
select
  c.organization_id,
  c.id,
  c.lead_score,
  c.priority,
  c.score_reason,
  coalesce(c.score_breakdown, '{}'::jsonb),
  coalesce(c.signal_count, 0),
  coalesce(c.last_verified_at, c.updated_at, c.created_at),
  true
from public.companies c
where c.organization_id is not null
  and c.lead_score is not null
  and not exists (
    select 1 from public.company_scores cs
    where cs.company_id = c.id and cs.is_current = true
  );

update public.companies c
set current_score_id = cs.id
from public.company_scores cs
where cs.company_id = c.id
  and cs.is_current = true
  and c.current_score_id is null;

-- Backfill: ai_summary → ai_summaries
insert into public.ai_summaries (
  organization_id,
  company_id,
  summary_type,
  content,
  model_version,
  generated_at,
  is_current
)
select
  c.organization_id,
  c.id,
  'recruitment_brief',
  c.ai_summary,
  'legacy',
  coalesce(c.updated_at, c.created_at),
  true
from public.companies c
where c.organization_id is not null
  and c.ai_summary is not null
  and length(trim(c.ai_summary)) > 0
  and not exists (
    select 1 from public.ai_summaries s
    where s.company_id = c.id and s.summary_type = 'recruitment_brief' and s.is_current = true
  );

update public.companies c
set current_summary_id = s.id
from public.ai_summaries s
where s.company_id = c.id
  and s.summary_type = 'recruitment_brief'
  and s.is_current = true
  and c.current_summary_id is null;

-- Backfill: company_vacancies → vacancies (detected)
insert into public.vacancies (
  organization_id,
  company_id,
  title,
  location,
  status,
  source,
  source_url,
  detected_at,
  is_relevant,
  external_id,
  created_at,
  updated_at
)
select
  cv.organization_id,
  cv.company_id,
  cv.title,
  null,
  'open',
  cv.source,
  cv.source_url,
  cv.detected_at,
  coalesce(cv.is_relevant, false),
  encode(sha256((cv.company_id::text || ':' || cv.title || ':' || coalesce(cv.source_url, ''))::bytea), 'hex'),
  cv.created_at,
  cv.created_at
from public.company_vacancies cv
where not exists (
  select 1 from public.vacancies v
  where v.company_id = cv.company_id
    and v.title = cv.title
    and coalesce(v.source_url, '') = coalesce(cv.source_url, '')
);

-- Backfill signal_count on companies
update public.companies c
set signal_count = sub.cnt,
    last_signal_at = sub.last_obs
from (
  select company_id, count(*) as cnt, max(observed_at) as last_obs
  from public.hiring_signals
  where company_id is not null
  group by company_id
) sub
where c.id = sub.company_id;

-- -----------------------------------------------------------------------------
-- 12. Intelligence views
-- -----------------------------------------------------------------------------
create or replace view public.companies_intelligence as
select
  c.id,
  c.organization_id,
  c.name,
  c.status,
  c.city,
  c.sector,
  c.website,
  c.domain,
  c.linkedin_url,
  c.hiring_intensity,
  c.signal_count,
  c.last_signal_at,
  cs.score as current_score,
  cs.priority as current_priority,
  cs.score_reason as current_score_reason,
  s.content as current_ai_summary,
  c.outreach_status,
  c.created_at,
  c.updated_at
from public.companies c
left join public.company_scores cs
  on cs.id = c.current_score_id and cs.is_current = true
left join public.ai_summaries s
  on s.id = c.current_summary_id and s.is_current = true;

-- -----------------------------------------------------------------------------
-- 13. updated_at triggers for new tables
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hiring_signals_updated_at on public.hiring_signals;
create trigger hiring_signals_updated_at
  before update on public.hiring_signals
  for each row execute function public.set_updated_at();

drop trigger if exists outreach_updated_at on public.outreach;
create trigger outreach_updated_at
  before update on public.outreach
  for each row execute function public.set_updated_at();
