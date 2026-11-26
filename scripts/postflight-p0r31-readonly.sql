-- Post-migration read-only checks (P0-R3.1)
select check_name, metric_value, detail
from (
  select 1 as ord, 'canonical_domain_column_exists' as check_name,
         case when exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'companies' and column_name = 'canonical_domain'
         ) then 'yes' else 'no' end as metric_value,
         null::text as detail
  union all
  select 2, 'fn_upsert_discovery_company',
         case when exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'upsert_discovery_company'
         ) then 'present' else 'missing' end,
         null
  union all
  select 3, 'fn_reserve_ai_recruiter_run_slot',
         case when exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'reserve_ai_recruiter_run_slot'
         ) then 'present' else 'missing' end,
         null
  union all
  select 4, 'unique_index_companies_org_canonical_domain',
         case when exists (
           select 1 from pg_indexes
           where schemaname = 'public' and tablename = 'companies'
             and indexname = 'companies_org_canonical_domain_unique'
         ) then 'present' else 'missing' end,
         null
  union all
  select 5, 'table_ai_recruiter_run_commit_counters',
         case when exists (
           select 1 from information_schema.tables
           where table_schema = 'public' and table_name = 'ai_recruiter_run_commit_counters'
         ) then 'present' else 'missing' end,
         null
  union all
  select 6, 'duplicate_canonical_domain_groups', count(*)::text, null
  from (
    select organization_id, lower(trim(canonical_domain)) as d
    from public.companies
    where canonical_domain is not null and trim(canonical_domain) <> ''
    group by 1, 2 having count(*) > 1
  ) x
  union all
  select 7, 'upsert_execute_authenticated',
         case when has_function_privilege('authenticated', 'public.upsert_discovery_company(uuid, text, jsonb)', 'execute')
         then 'yes' else 'no' end,
         null
  union all
  select 8, 'reserve_slot_execute_authenticated',
         case when has_function_privilege('authenticated', 'public.reserve_ai_recruiter_run_slot(uuid, uuid, text, integer)', 'execute')
         then 'yes' else 'no' end,
         null
) metrics
order by ord;