-- Lead Intelligence Engine: extend companies, jobs, and supporting tables

-- ============================================================
-- companies: lead intelligence fields
-- ============================================================
alter table public.companies
  add column if not exists domain text,
  add column if not exists linkedin_url text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists region text,
  add column if not exists country text default 'NL',
  add column if not exists employee_count_min integer,
  add column if not exists employee_count_max integer,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists confidence numeric(4, 3) check (confidence >= 0 and confidence <= 1),
  add column if not exists lead_score integer check (lead_score >= 0 and lead_score <= 100),
  add column if not exists priority text check (priority in ('A', 'B', 'C')),
  add column if not exists score_reason text,
  add column if not exists score_breakdown jsonb default '{}'::jsonb,
  add column if not exists vacancy_count integer default 0,
  add column if not exists hiring_signals jsonb default '[]'::jsonb,
  add column if not exists last_verified_at timestamptz,
  add column if not exists outreach_status text default 'none'
    check (outreach_status in ('none', 'queued', 'draft', 'review', 'sent', 'blocked'));

create index if not exists companies_org_lead_score_idx
  on public.companies (organization_id, lead_score desc nulls last);

create index if not exists companies_org_priority_idx
  on public.companies (organization_id, priority);

create index if not exists companies_org_outreach_idx
  on public.companies (organization_id, outreach_status);

-- ============================================================
-- company_search_jobs: extended statuses and counters
-- ============================================================
alter table public.company_search_jobs
  add column if not exists updated_count integer not null default 0,
  add column if not exists error_count integer not null default 0,
  add column if not exists provider_errors jsonb default '[]'::jsonb,
  add column if not exists cancelled_at timestamptz;

-- Relax status check to support lead intelligence phases
alter table public.company_search_jobs drop constraint if exists company_search_jobs_status_check;

alter table public.company_search_jobs
  add constraint company_search_jobs_status_check check (
    status in (
      'queued', 'pending', 'running', 'searching', 'enriching',
      'deduplicating', 'scoring', 'saving', 'completed',
      'partially_completed', 'failed', 'cancelled'
    )
  );

-- ============================================================
-- company_search_job_events
-- ============================================================
create table if not exists public.company_search_job_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.company_search_jobs (id) on delete cascade,
  event_type text not null,
  provider_name text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_search_job_events_job_idx
  on public.company_search_job_events (job_id, created_at);

alter table public.company_search_job_events enable row level security;

do $policy$
begin
  execute $sql$
    create policy "company_search_job_events_tenant"
    on public.company_search_job_events
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

-- ============================================================
-- company_sources
-- ============================================================
create table if not exists public.company_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  provider_name text not null,
  external_id text,
  source_url text,
  confidence numeric(4, 3) check (confidence >= 0 and confidence <= 1),
  raw_data jsonb default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_sources_company_idx
  on public.company_sources (company_id);

alter table public.company_sources enable row level security;

do $policy$
begin
  execute $sql$
    create policy "company_sources_tenant"
    on public.company_sources
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

-- ============================================================
-- company_enrichment_results
-- ============================================================
create table if not exists public.company_enrichment_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  field_name text not null,
  field_value text,
  source text not null,
  confidence numeric(4, 3) check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists company_enrichment_company_idx
  on public.company_enrichment_results (company_id, field_name);

alter table public.company_enrichment_results enable row level security;

do $policy$
begin
  execute $sql$
    create policy "company_enrichment_results_tenant"
    on public.company_enrichment_results
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

-- ============================================================
-- company_vacancies (detected hiring signals)
-- ============================================================
create table if not exists public.company_vacancies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  source text not null,
  source_url text,
  is_relevant boolean default false,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists company_vacancies_company_idx
  on public.company_vacancies (company_id);

alter table public.company_vacancies enable row level security;

do $policy$
begin
  execute $sql$
    create policy "company_vacancies_tenant"
    on public.company_vacancies
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

-- ============================================================
-- outreach_queue
-- ============================================================
create table if not exists public.outreach_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  suggested_contact_role text,
  outreach_angle text,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'sent', 'cancelled', 'blocked')),
  review_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outreach_queue_active_company_idx
  on public.outreach_queue (organization_id, company_id)
  where status in ('draft', 'review', 'approved');

create index if not exists outreach_queue_org_status_idx
  on public.outreach_queue (organization_id, status);

alter table public.outreach_queue enable row level security;

do $policy$
begin
  execute $sql$
    create policy "outreach_queue_tenant"
    on public.outreach_queue
    for all
    using (
      organization_id = public.current_organization_id()
    )
    with check (
      organization_id = public.current_organization_id()
    )
  $sql$;
exception when duplicate_object then null;
end
$policy$;
