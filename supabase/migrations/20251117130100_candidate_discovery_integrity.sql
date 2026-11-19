-- Candidate Discovery — integriteit org ↔ vacature ↔ run ↔ voorstel (F1/F2)
-- Additief; geen wijziging aan bestaande rijen zonder expliciete insert/update.

create or replace function public.candidate_discovery_validate_run()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.vacancies v
    where v.id = new.vacancy_id
      and v.organization_id = new.organization_id
  ) then
    raise exception 'candidate_discovery_vacancy_org_mismatch'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists candidate_discovery_runs_validate_tenant on public.candidate_discovery_runs;
create trigger candidate_discovery_runs_validate_tenant
  before insert or update on public.candidate_discovery_runs
  for each row
  execute function public.candidate_discovery_validate_run();

create or replace function public.candidate_discovery_validate_proposal()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  run_row public.candidate_discovery_runs%rowtype;
begin
  select *
  into run_row
  from public.candidate_discovery_runs r
  where r.id = new.run_id;

  if not found then
    raise exception 'candidate_discovery_run_not_found'
      using errcode = 'foreign_key_violation';
  end if;

  if run_row.organization_id is distinct from new.organization_id then
    raise exception 'candidate_discovery_proposal_org_mismatch'
      using errcode = 'check_violation';
  end if;

  if run_row.vacancy_id is distinct from new.vacancy_id then
    raise exception 'candidate_discovery_proposal_vacancy_mismatch'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
    from public.vacancies v
    where v.id = new.vacancy_id
      and v.organization_id = new.organization_id
  ) then
    raise exception 'candidate_discovery_vacancy_org_mismatch'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists candidate_discovery_proposals_validate_tenant on public.candidate_discovery_proposals;
create trigger candidate_discovery_proposals_validate_tenant
  before insert or update on public.candidate_discovery_proposals
  for each row
  execute function public.candidate_discovery_validate_proposal();

comment on function public.candidate_discovery_validate_run() is
  'F1: vacancy_id moet bij organization_id van de discovery-run horen.';
comment on function public.candidate_discovery_validate_proposal() is
  'F2: proposal org/vacancy moet overeenkomen met de gekoppelde run en vacature-org.';