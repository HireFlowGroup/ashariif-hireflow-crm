select check_name, metric_value, detail
from (
  select 1 as ord, 'duplicate_domain_groups' as check_name,
         count(*)::text as metric_value, null::text as detail
  from (
    select organization_id, lower(trim(domain)) as d
    from public.companies
    where domain is not null and trim(domain) <> ''
    group by 1, 2 having count(*) > 1
  ) dups
  union all
  select 2, 'duplicate_website_groups', count(*)::text, null
  from (
    select organization_id, lower(trim(website)) as w
    from public.companies
    where website is not null and trim(website) <> ''
    group by 1, 2 having count(*) > 1
  ) wdup
  union all
  select 3, 'canonical_domain_column_exists',
         case when exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'companies' and column_name = 'canonical_domain'
         ) then 'yes' else 'no' end,
         null
  union all
  select 13, 'duplicate_canonical_domain_groups', 'deferred_to_postflight', null
  union all
  select 4, 'duplicate_run_item_groups', count(*)::text, null
  from (
    select run_id, company_id
    from public.ai_recruiter_run_items
    where company_id is not null
    group by 1, 2 having count(*) > 1
  ) ridup
  union all
  select 5, 'run_item_org_mismatch', count(*)::text, null
  from public.ai_recruiter_run_items ri
  join public.ai_recruiter_runs r on r.id = ri.run_id
  where ri.organization_id <> r.organization_id
  union all
  select 6, 'row_count_companies', count(*)::text, null from public.companies
  union all
  select 7, 'row_count_ai_recruiter_runs', count(*)::text, null from public.ai_recruiter_runs
  union all
  select 8, 'row_count_ai_recruiter_run_items', count(*)::text, null from public.ai_recruiter_run_items
  union all
  select 9, 'row_count_prospect_decisions', count(*)::text, null from public.ai_recruiter_prospect_decisions
  union all
  select 10, 'fn_upsert_discovery_company',
         case when exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'upsert_discovery_company'
         ) then 'present' else 'missing' end, null
  union all
  select 11, 'fn_reserve_ai_recruiter_run_slot',
         case when exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'reserve_ai_recruiter_run_slot'
         ) then 'present' else 'missing' end, null
  union all
  select 12, 'unique_index_companies_org_canonical_domain',
         case when exists (
           select 1 from pg_indexes
           where schemaname = 'public' and tablename = 'companies'
             and indexname = 'companies_org_canonical_domain_unique'
         ) then 'present' else 'missing' end, null
) metrics
order by ord;