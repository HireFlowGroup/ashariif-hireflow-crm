-- HireFlow AI initial schema
-- Apply with Supabase CLI: supabase db push

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'recruiter' check (role in ('owner', 'admin', 'recruiter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  industry text,
  website text,
  status text not null default 'prospect' check (status in ('active', 'inactive', 'prospect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  source text,
  status text not null default 'new' check (
    status in ('new', 'screening', 'interview', 'offer', 'hired', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vacancies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  location text,
  employment_type text not null default 'full_time' check (
    employment_type in ('full_time', 'part_time', 'contract', 'temporary')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'open', 'on_hold', 'closed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  stage text not null default 'applied' check (
    stage in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')
  ),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vacancy_id, candidate_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  assignee_id uuid references public.profiles (id) on delete set null,
  related_type text check (
    related_type in ('company', 'contact', 'candidate', 'vacancy')
  ),
  related_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.candidates enable row level security;
alter table public.vacancies enable row level security;
alter table public.pipeline_entries enable row level security;
alter table public.tasks enable row level security;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

do $policy$
begin
  execute $sql$
    create policy "profiles_select_own"
    on public.profiles
    for select
    using (id = auth.uid())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "profiles_select_own_org"
    on public.profiles
    for select
    using (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_companies"
    on public.companies
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_contacts"
    on public.contacts
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_candidates"
    on public.candidates
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_vacancies"
    on public.vacancies
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_pipeline_entries"
    on public.pipeline_entries
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$policy$;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_tasks"
    on public.tasks
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$policy$;
