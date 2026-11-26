-- P0-R3.2.5 — Minimal table privileges for tenant-scoped RLS on ai_summaries (test project first).
-- RLS policy ai_summaries_tenant remains enforced; this fixes PostgreSQL "permission denied" before RLS.

grant select, insert, update, delete on table public.ai_summaries to authenticated;