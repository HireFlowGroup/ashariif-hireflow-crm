-- Fix companies RLS for authenticated tenant inserts (Company Finder discovery save).
--
-- Root cause: blanket FOR ALL policy + JWT-dependent current_organization_id()
-- can reject INSERT when auth.uid() is unavailable on the Supabase client role,
-- even though the API route validated the user session separately.
--
-- Strategy:
-- 1. Replace single FOR ALL policy with explicit SELECT/INSERT/UPDATE/DELETE policies
-- 2. Require authenticated role + matching organization_id on INSERT
-- 3. Harden current_organization_id() (security definer, stable)

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

comment on function public.current_organization_id() is
  'Returns organization_id for auth.uid() from profiles; used by tenant RLS policies.';

drop policy if exists "tenant_isolation_companies" on public.companies;

create policy "companies_select_org"
  on public.companies
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

create policy "companies_insert_org"
  on public.companies
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and organization_id is not null
    and organization_id = public.current_organization_id()
  );

create policy "companies_update_org"
  on public.companies
  for update
  to authenticated
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "companies_delete_org"
  on public.companies
  for delete
  to authenticated
  using (organization_id = public.current_organization_id());

-- Service role (server-side trusted writes) bypasses RLS by design.
-- Application layer MUST always scope by organization_id from authenticated context.

grant select, insert, update, delete on public.companies to authenticated;
