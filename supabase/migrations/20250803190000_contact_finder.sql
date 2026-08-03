-- Contact Finder: enrich contacts table + async search jobs

alter table public.contacts
  add column if not exists linkedin_url text,
  add column if not exists source text,
  add column if not exists confidence numeric(4, 3) check (confidence >= 0 and confidence <= 1),
  add column if not exists last_verified timestamptz;

create index if not exists contacts_company_id_idx
  on public.contacts (company_id)
  where company_id is not null;

create index if not exists contacts_org_company_idx
  on public.contacts (organization_id, company_id);

create table if not exists public.contact_search_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed')
  ),
  criteria jsonb not null default '{}'::jsonb,
  found_count integer not null default 0,
  saved_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_search_jobs_org_created_idx
  on public.contact_search_jobs (organization_id, created_at desc);

create index if not exists contact_search_jobs_company_idx
  on public.contact_search_jobs (company_id, created_at desc);

alter table public.contact_search_jobs enable row level security;

do $policy$
begin
  execute $sql$
    create policy "contact_search_jobs_tenant"
    on public.contact_search_jobs
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
