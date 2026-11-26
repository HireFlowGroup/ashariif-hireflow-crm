-- APPLY ONLY AFTER HUMAN APPROVAL + PREFLIGHT ON TEST (vcmegbghsaqagikfxces)
-- P0-R3.1 — Database Integrity, Concurrency & Persistence

begin;

-- ---------------------------------------------------------------------------
-- 1) Canonical domain
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists canonical_domain text;

comment on column public.companies.canonical_domain is
  'Normalized employer hostname per organization; NULL if unknown, job-board, or shared hosting.';

create unique index if not exists companies_org_canonical_domain_unique
  on public.companies (organization_id, canonical_domain)
  where canonical_domain is not null;

create index if not exists companies_org_canonical_domain_idx
  on public.companies (organization_id, canonical_domain)
  where canonical_domain is not null;

-- ---------------------------------------------------------------------------
-- 2) Run commit counters (atomic caps)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_recruiter_run_commit_counters (
  run_id uuid primary key references public.ai_recruiter_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  companies_committed integer not null default 0 check (companies_committed >= 0),
  drafts_committed integer not null default 0 check (drafts_committed >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists ai_recruiter_run_commit_counters_org_idx
  on public.ai_recruiter_run_commit_counters (organization_id);

alter table public.ai_recruiter_run_commit_counters enable row level security;

drop policy if exists ai_recruiter_run_commit_counters_tenant on public.ai_recruiter_run_commit_counters;
create policy ai_recruiter_run_commit_counters_tenant
  on public.ai_recruiter_run_commit_counters
  for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- ---------------------------------------------------------------------------
-- 3) Idempotent company upsert (tenant + auth guarded)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_discovery_company(
  p_organization_id uuid,
  p_canonical_domain text,
  p_payload jsonb
) returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.companies;
  v_caller_org uuid;
begin
  v_caller_org := public.current_organization_id();
  if v_caller_org is null or v_caller_org <> p_organization_id then
    raise exception 'tenant_mismatch' using errcode = '42501';
  end if;

  if p_canonical_domain is null or length(trim(p_canonical_domain)) = 0 then
    insert into public.companies (
      organization_id,
      name,
      website,
      domain,
      canonical_domain,
      status,
      city,
      sector,
      source,
      source_url,
      owner_id
    ) values (
      p_organization_id,
      coalesce(p_payload->>'name', 'Onbekend'),
      nullif(p_payload->>'website', ''),
      nullif(p_payload->>'domain', ''),
      null,
      coalesce(nullif(p_payload->>'status', ''), 'prospect'),
      nullif(p_payload->>'city', ''),
      nullif(p_payload->>'sector', ''),
      nullif(p_payload->>'source', ''),
      nullif(p_payload->>'source_url', ''),
      nullif(p_payload->>'owner_id', '')::uuid
    )
    returning * into v_row;
    return v_row;
  end if;

  insert into public.companies (
    organization_id,
    name,
    website,
    domain,
    canonical_domain,
    status,
    city,
    sector,
    source,
    source_url,
    owner_id
  ) values (
    p_organization_id,
    coalesce(p_payload->>'name', 'Onbekend'),
    nullif(p_payload->>'website', ''),
    nullif(p_payload->>'domain', ''),
    lower(trim(p_canonical_domain)),
    coalesce(nullif(p_payload->>'status', ''), 'prospect'),
    nullif(p_payload->>'city', ''),
    nullif(p_payload->>'sector', ''),
    nullif(p_payload->>'source', ''),
    nullif(p_payload->>'source_url', ''),
    nullif(p_payload->>'owner_id', '')::uuid
  )
  on conflict (organization_id, canonical_domain)
  where canonical_domain is not null
  do update set
    name = excluded.name,
    website = coalesce(excluded.website, companies.website),
    domain = coalesce(excluded.domain, companies.domain),
    city = coalesce(excluded.city, companies.city),
    sector = coalesce(excluded.sector, companies.sector),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_discovery_company(uuid, text, jsonb) from public;
grant execute on function public.upsert_discovery_company(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Atomic slot reservation
-- ---------------------------------------------------------------------------
create or replace function public.reserve_ai_recruiter_run_slot(
  p_run_id uuid,
  p_organization_id uuid,
  p_slot text,
  p_max integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org uuid;
  v_updated integer;
begin
  if p_max < 0 then
    return false;
  end if;

  v_caller_org := public.current_organization_id();
  if v_caller_org is null or v_caller_org <> p_organization_id then
    raise exception 'tenant_mismatch' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.ai_recruiter_runs r
    where r.id = p_run_id and r.organization_id = p_organization_id
  ) then
    return false;
  end if;

  insert into public.ai_recruiter_run_commit_counters (run_id, organization_id)
  values (p_run_id, p_organization_id)
  on conflict (run_id) do nothing;

  if p_slot = 'company' then
    update public.ai_recruiter_run_commit_counters c
    set companies_committed = c.companies_committed + 1,
        updated_at = now()
    where c.run_id = p_run_id
      and c.organization_id = p_organization_id
      and c.companies_committed < p_max;
    get diagnostics v_updated = row_count;
    return v_updated = 1;
  elsif p_slot = 'draft' then
    update public.ai_recruiter_run_commit_counters c
    set drafts_committed = c.drafts_committed + 1,
        updated_at = now()
    where c.run_id = p_run_id
      and c.organization_id = p_organization_id
      and c.drafts_committed < p_max;
    get diagnostics v_updated = row_count;
    return v_updated = 1;
  end if;

  return false;
end;
$$;

create or replace function public.release_ai_recruiter_run_slot(
  p_run_id uuid,
  p_organization_id uuid,
  p_slot text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org uuid;
  v_updated integer;
begin
  v_caller_org := public.current_organization_id();
  if v_caller_org is null or v_caller_org <> p_organization_id then
    raise exception 'tenant_mismatch' using errcode = '42501';
  end if;

  if p_slot = 'company' then
    update public.ai_recruiter_run_commit_counters
    set companies_committed = greatest(companies_committed - 1, 0),
        updated_at = now()
    where run_id = p_run_id and organization_id = p_organization_id;
    get diagnostics v_updated = row_count;
    return v_updated = 1;
  elsif p_slot = 'draft' then
    update public.ai_recruiter_run_commit_counters
    set drafts_committed = greatest(drafts_committed - 1, 0),
        updated_at = now()
    where run_id = p_run_id and organization_id = p_organization_id;
    get diagnostics v_updated = row_count;
    return v_updated = 1;
  end if;

  return false;
end;
$$;

revoke all on function public.reserve_ai_recruiter_run_slot(uuid, uuid, text, integer) from public;
grant execute on function public.reserve_ai_recruiter_run_slot(uuid, uuid, text, integer) to authenticated;
revoke all on function public.release_ai_recruiter_run_slot(uuid, uuid, text) from public;
grant execute on function public.release_ai_recruiter_run_slot(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Run item idempotency
-- ---------------------------------------------------------------------------
create unique index if not exists ai_recruiter_run_items_run_company_unique
  on public.ai_recruiter_run_items (run_id, company_id)
  where company_id is not null;

alter table public.ai_recruiter_run_items
  add column if not exists qualification_status text,
  add column if not exists evidence_bundle jsonb not null default '{}'::jsonb,
  add column if not exists source_idempotency_key text;

create unique index if not exists ai_recruiter_run_items_run_idempotency_unique
  on public.ai_recruiter_run_items (run_id, source_idempotency_key)
  where source_idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- 6) Prospect audit evidence columns (durable reporting)
-- ---------------------------------------------------------------------------
alter table public.ai_recruiter_prospect_decisions
  add column if not exists qualification_status text
    check (qualification_status is null or qualification_status in (
      'eligible', 'needs_evidence', 'rejected', 'manual_override'
    )),
  add column if not exists evidence_bundle jsonb not null default '{}'::jsonb,
  add column if not exists enrichment_diagnostics jsonb not null default '{}'::jsonb,
  add column if not exists qualification_contract_version text;

create index if not exists ai_recruiter_prospect_decisions_qual_status_idx
  on public.ai_recruiter_prospect_decisions (organization_id, qualification_status)
  where qualification_status is not null;

commit;