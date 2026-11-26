-- P0-R3.1 post-migration integration checks (isolated labels, no production prospects).
-- Uses superuser/session context via CLI; validates schema + function signatures + grant bits.
-- Does NOT invoke tenant-guarded RPC without JWT (use application tests for full RPC path).

begin;

select case when exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'upsert_discovery_company'
) then 'ok' else 'missing' end as upsert_fn;

select case when exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'reserve_ai_recruiter_run_slot'
) then 'ok' else 'missing' end as reserve_fn;

select case when
  has_function_privilege('authenticated', 'public.upsert_discovery_company(uuid, text, jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.reserve_ai_recruiter_run_slot(uuid, uuid, text, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.release_ai_recruiter_run_slot(uuid, uuid, text)', 'execute')
then 'ok' else 'grant_missing' end as authenticated_grants;

-- Partial unique index must exist for canonical domains
select case when exists (
  select 1 from pg_indexes
  where schemaname = 'public' and indexname = 'companies_org_canonical_domain_unique'
) then 'ok' else 'missing' end as canonical_unique;

-- Cap table present
select case when exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'ai_recruiter_run_commit_counters'
) then 'ok' else 'missing' end as cap_table;

rollback;