-- QA READONLY — baseline commit counters + RPC presence (vcmegbghsaqagikfxces)
select case when exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'reserve_ai_recruiter_run_slot'
) then 'ok' else 'missing' end as reserve_fn;

select count(*)::int as commit_counter_rows from public.ai_recruiter_run_commit_counters;

select id, name, status from public.ai_recruiter_runs
where name ilike '%QA_SLOT_SYNTHETIC%'
order by created_at desc
limit 3;