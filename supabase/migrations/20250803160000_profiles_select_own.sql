-- Users must be able to read their own profile row so current_organization_id()
-- and server-side tenant context can bootstrap without circular RLS.

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
end
$policy$;
