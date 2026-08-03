-- Company Finder search jobs (multi-provider, tenant-scoped)

create table if not exists public.company_search_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed')
  ),
  criteria jsonb not null default '{}'::jsonb,
  found_count integer not null default 0,
  saved_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_search_jobs_org_created_idx
  on public.company_search_jobs (organization_id, created_at desc);

alter table public.company_search_jobs enable row level security;

do $policy$
begin
  execute $sql$
    create policy "company_search_jobs_tenant"
    on public.company_search_jobs
    for all
    using (
      user_id = auth.uid()
      and organization_id = public.current_organization_id()
    )
    with check (
      user_id = auth.uid()
      and organization_id = public.current_organization_id()
    )
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
end
$policy$;
