-- Align legacy public.companies with multi-tenant schema (organization_id).

alter table public.companies
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade,
  add column if not exists industry text,
  add column if not exists website text,
  add column if not exists updated_at timestamptz default now();

-- Backfill tenant from owner profile.
update public.companies c
set organization_id = p.organization_id
from public.profiles p
where c.organization_id is null
  and c.owner_id = p.id;

-- Backfill tenant from user profile when owner_id is absent.
update public.companies c
set organization_id = p.organization_id
from public.profiles p
where c.organization_id is null
  and c.user_id = p.id;

-- Keep industry in sync with legacy sector column.
update public.companies
set industry = sector
where industry is null
  and sector is not null;

update public.companies
set updated_at = created_at
where updated_at is null;
