-- Backfill companies.organization_id when owner/user profile mapping was incomplete.

update public.companies c
set organization_id = p.organization_id
from public.profiles p
where c.organization_id is null
  and c.owner_id is not null
  and c.owner_id = p.id;

update public.companies c
set organization_id = p.organization_id
from public.profiles p
where c.organization_id is null
  and c.user_id is not null
  and c.user_id = p.id;

-- Single-tenant fallback: assign to the only organization when unambiguous.
update public.companies c
set organization_id = o.id
from public.organizations o
where c.organization_id is null
  and (select count(*) from public.organizations) = 1;
