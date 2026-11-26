-- Align legacy public.companies with multi-tenant schema (organization_id).

alter table public.companies
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade,
  add column if not exists industry text,
  add column if not exists website text,
  add column if not exists updated_at timestamptz default now();

-- Backfill tenant from owner profile (legacy DBs where owner_id exists).
do $backfill_owner$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'owner_id'
  ) then
    update public.companies c
    set organization_id = p.organization_id
    from public.profiles p
    where c.organization_id is null
      and c.owner_id is not null
      and c.owner_id = p.id;
  end if;
end
$backfill_owner$;

-- Backfill tenant from user profile when owner_id mapping is absent (legacy only).
do $backfill_user$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'user_id'
  ) then
    update public.companies c
    set organization_id = p.organization_id
    from public.profiles p
    where c.organization_id is null
      and c.user_id is not null
      and c.user_id = p.id;
  end if;
end
$backfill_user$;

-- Keep industry in sync with legacy sector column (when sector exists).
do $sector_sync$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'sector'
  ) then
    update public.companies
    set industry = sector
    where industry is null
      and sector is not null;
  end if;
end
$sector_sync$;

update public.companies
set updated_at = created_at
where updated_at is null;