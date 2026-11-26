-- Grant PostgREST/API table privileges for authenticated users (Supabase hosted: no auto_expose).
-- RLS policies remain the tenant boundary; this migration only restores missing table-level GRANTs.
-- Idempotent: re-running GRANT statements is safe.
--
-- Scope: tables read/written by the authenticated Supabase client on the AI Recruiter path
-- (session profile lookup, runs/items/audit, company finder, contacts, recruitment intelligence).
-- Does NOT grant schema-wide privileges or alter RLS.

grant usage on schema public to authenticated;

-- ---------------------------------------------------------------------------
-- 1) Authenticated session / tenant context (getSessionProfile → organization_id)
-- ---------------------------------------------------------------------------
grant select on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2) AI Recruiter core (RLS: tenant_isolation_* on each table)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on table public.ai_recruiter_runs to authenticated;
grant select, insert, update, delete on table public.ai_recruiter_run_items to authenticated;
grant select, insert, update on table public.ai_recruiter_prospect_decisions to authenticated;
grant select, insert on table public.ai_recruiter_replies to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Discovery & contact pipeline (auth client in orchestrator / finder)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on table public.company_search_jobs to authenticated;
grant select, insert, update, delete on table public.contact_search_jobs to authenticated;
grant select, insert on table public.contact_finder_traces to authenticated;
grant select, insert, update, delete on table public.contacts to authenticated;

-- companies + outreach_* tables already have GRANTs in 20250804200000 / 20250805100000 / 20250806120000

-- ---------------------------------------------------------------------------
-- 4) Recruitment intelligence & signals (read during scoring / analysis persist)
-- ---------------------------------------------------------------------------
grant select, insert, update on table public.recruitment_intelligence_analyses to authenticated;
grant select, insert, update on table public.hiring_signals to authenticated;
grant select on table public.vacancies to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Prospect dossier side effects
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on table public.tasks to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Provider vault (search/crawler key resolution at discovery start)
-- ---------------------------------------------------------------------------
grant select on table public.organization_provider_configs to authenticated;