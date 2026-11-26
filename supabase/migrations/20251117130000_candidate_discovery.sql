-- Candidate Discovery — runs & proposals (SERP-derived, geen auto-CRM)
-- AVG: minimale publieke velden; runs verlopen na retention_days (default 90).

-- ---------------------------------------------------------------------------
-- candidate_discovery_runs
-- ---------------------------------------------------------------------------
create table if not exists public.candidate_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'partial')
  ),
  queries jsonb not null default '[]'::jsonb,
  query_plan jsonb not null default '{}'::jsonb,
  search_attempts jsonb not null default '[]'::jsonb,
  provider_meta jsonb not null default '{}'::jsonb,
  proposal_count integer not null default 0 check (proposal_count >= 0),
  below_threshold_count integer not null default 0 check (below_threshold_count >= 0),
  ineligible_count integer not null default 0 check (ineligible_count >= 0),
  duplicate_url_count integer not null default 0 check (duplicate_url_count >= 0),
  provider_failures integer not null default 0 check (provider_failures >= 0),
  min_match_score_used integer not null default 45 check (min_match_score_used between 0 and 100),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  retention_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_discovery_runs_org_vacancy_idx
  on public.candidate_discovery_runs (organization_id, vacancy_id, created_at desc);

create index if not exists candidate_discovery_runs_org_status_idx
  on public.candidate_discovery_runs (organization_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- candidate_discovery_proposals
-- ---------------------------------------------------------------------------
create table if not exists public.candidate_discovery_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  run_id uuid not null references public.candidate_discovery_runs (id) on delete cascade,
  rank integer not null check (rank >= 1 and rank <= 5),
  linkedin_url text not null,
  linkedin_profile_slug text,
  first_name text not null default 'Onbekend',
  last_name text not null default 'Onbekend',
  candidate_current_role text,
  location text,
  summary text,
  skills jsonb not null default '[]'::jsonb,
  experience_years integer check (experience_years is null or (experience_years >= 0 and experience_years <= 60)),
  unknown_fields jsonb not null default '[]'::jsonb,
  source_provider text,
  source_query text,
  serp_title text,
  serp_snippet text,
  match_score integer not null check (match_score between 0 and 100),
  match_breakdown jsonb not null default '{}'::jsonb,
  match_strong_points jsonb not null default '[]'::jsonb,
  match_risks jsonb not null default '[]'::jsonb,
  match_missing_info jsonb not null default '[]'::jsonb,
  match_rationale jsonb not null default '[]'::jsonb,
  approval_status text not null default 'proposed' check (
    approval_status in ('proposed', 'approved', 'rejected', 'saved')
  ),
  saved_candidate_id uuid references public.candidates (id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_discovery_proposals_org_vacancy_linkedin_uniq
    unique (organization_id, vacancy_id, linkedin_url)
);

create index if not exists candidate_discovery_proposals_run_idx
  on public.candidate_discovery_proposals (run_id, rank);

create index if not exists candidate_discovery_proposals_org_vacancy_idx
  on public.candidate_discovery_proposals (organization_id, vacancy_id, approval_status);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists candidate_discovery_runs_updated_at on public.candidate_discovery_runs;
create trigger candidate_discovery_runs_updated_at
  before update on public.candidate_discovery_runs
  for each row execute function public.set_updated_at();

drop trigger if exists candidate_discovery_proposals_updated_at on public.candidate_discovery_proposals;
create trigger candidate_discovery_proposals_updated_at
  before update on public.candidate_discovery_proposals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — tenant isolation (zelfde patroon als AI Recruiter)
-- ---------------------------------------------------------------------------
alter table public.candidate_discovery_runs enable row level security;
alter table public.candidate_discovery_proposals enable row level security;

do $policy$
begin
  create policy tenant_isolation_candidate_discovery_runs on public.candidate_discovery_runs
    for all using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id());
exception when duplicate_object then null;
end $policy$;

do $policy$
begin
  create policy tenant_isolation_candidate_discovery_proposals on public.candidate_discovery_proposals
    for all using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id());
exception when duplicate_object then null;
end $policy$;

comment on table public.candidate_discovery_runs is
  'Kandidaat-discovery zoekruns gekoppeld aan vacature; geen automatische CRM-insert.';
comment on table public.candidate_discovery_proposals is
  'Voorstellen uit publieke SERP; uniek per org+vacature+linkedin_url; handmatige goedkeuring vereist.';
comment on column public.candidate_discovery_runs.retention_expires_at is
  'Advies bewaartermijn voor persoonsgegevens uit zoekresultaten (AVG); opruimen via scheduled job later.';