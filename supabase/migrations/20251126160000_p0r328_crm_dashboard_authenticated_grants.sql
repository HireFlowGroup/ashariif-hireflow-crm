-- P0-R3.2.8 — CRM dashboard & intelligence notifications (authenticated, RLS unchanged)
-- Minimal table/view GRANTs for PostgREST; tenant boundary remains organization_id policies.

begin;

grant select on table public.pipeline_entries to authenticated;

grant select, update on table public.intelligence_notifications to authenticated;

grant select on table public.intelligence_scan_runs to authenticated;

grant select, insert, update, delete on table public.commercial_pipeline_cards to authenticated;

grant select on table public.company_scores to authenticated;

grant select on public.companies_intelligence to authenticated;

commit;