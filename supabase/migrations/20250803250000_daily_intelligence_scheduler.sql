-- Daily Hiring Intelligence Scheduler: runs, queue workers, notifications

create table if not exists public.intelligence_scan_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  triggered_by text not null default 'cron' check (triggered_by in ('cron', 'manual')),
  status text not null default 'scheduled' check (
    status in ('scheduled', 'running', 'completed', 'failed', 'cancelled')
  ),
  companies_total integer not null default 0,
  companies_processed integer not null default 0,
  signals_created integer not null default 0,
  signals_updated integer not null default 0,
  notifications_created integer not null default 0,
  errors_count integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intelligence_scan_runs_org_created_idx
  on public.intelligence_scan_runs (organization_id, created_at desc);

create table if not exists public.intelligence_scan_queue (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.intelligence_scan_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed', 'skipped')
  ),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  locked_at timestamptz,
  locked_by text,
  scheduled_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, company_id)
);

create index if not exists intelligence_scan_queue_pending_idx
  on public.intelligence_scan_queue (scheduled_at asc)
  where status = 'pending';

create index if not exists intelligence_scan_queue_run_idx
  on public.intelligence_scan_queue (run_id, status);

create index if not exists intelligence_scan_queue_org_company_idx
  on public.intelligence_scan_queue (organization_id, company_id, created_at desc);

create table if not exists public.intelligence_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  scan_run_id uuid references public.intelligence_scan_runs (id) on delete set null,
  queue_job_id uuid references public.intelligence_scan_queue (id) on delete set null,
  notification_type text not null check (
    notification_type in (
      'new_vacancy', 'new_recruiter', 'new_hr_manager', 'new_location',
      'website_change', 'news', 'linkedin_change', 'ats_detected',
      'signal_updated', 'score_increased', 'score_decreased', 'priority_changed'
    )
  ),
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_notifications_org_unread_idx
  on public.intelligence_notifications (organization_id, created_at desc)
  where read_at is null;

create index if not exists intelligence_notifications_company_idx
  on public.intelligence_notifications (company_id, created_at desc);

alter table public.intelligence_scan_runs enable row level security;
alter table public.intelligence_scan_queue enable row level security;
alter table public.intelligence_notifications enable row level security;

do $policy$
begin
  execute $sql$
    create policy "intelligence_scan_runs_tenant"
    on public.intelligence_scan_runs for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "intelligence_scan_queue_tenant"
    on public.intelligence_scan_queue for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "intelligence_notifications_tenant"
    on public.intelligence_notifications for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

-- Atomic worker claim (service role / security definer)
create or replace function public.claim_intelligence_scan_jobs(
  p_worker_id text,
  p_batch_size integer default 5
)
returns setof public.intelligence_scan_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.intelligence_scan_queue q
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    attempts = q.attempts + 1,
    updated_at = now()
  where q.id in (
    select sq.id
    from public.intelligence_scan_queue sq
    where sq.status = 'pending'
      and sq.scheduled_at <= now()
      and sq.attempts < sq.max_attempts
    order by sq.scheduled_at asc
    limit greatest(1, least(p_batch_size, 50))
    for update skip locked
  )
  returning *;
end;
$$;

-- Release stale processing jobs (> 30 min)
create or replace function public.release_stale_intelligence_scan_jobs(
  p_stale_minutes integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.intelligence_scan_queue
  set
    status = case when attempts >= max_attempts then 'failed' else 'pending' end,
    locked_at = null,
    locked_by = null,
    last_error = coalesce(last_error, 'Worker timeout'),
    updated_at = now()
  where status = 'processing'
    and locked_at < now() - make_interval(mins => p_stale_minutes);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

drop trigger if exists intelligence_scan_runs_updated_at on public.intelligence_scan_runs;
create trigger intelligence_scan_runs_updated_at
  before update on public.intelligence_scan_runs
  for each row execute function public.set_updated_at();

drop trigger if exists intelligence_scan_queue_updated_at on public.intelligence_scan_queue;
create trigger intelligence_scan_queue_updated_at
  before update on public.intelligence_scan_queue
  for each row execute function public.set_updated_at();
