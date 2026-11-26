-- PROPOSAL ONLY — do NOT apply without explicit approval (P0-R2 audit).
-- Purpose: durable qualification_status + structured evidence JSON on prospect audit rows.

-- alter table public.ai_recruiter_prospect_decisions
--   add column if not exists qualification_status text not null default 'ineligible'
--     check (qualification_status in ('eligible', 'needs_evidence', 'rejected', 'manual_override')),
--   add column if not exists evidence_json jsonb not null default '[]'::jsonb,
--   add column if not exists enrichment_json jsonb not null default '{}'::jsonb,
--   add column if not exists qualification_contract_version text;

-- create index if not exists ai_recruiter_prospect_decisions_qualification_status_idx
--   on public.ai_recruiter_prospect_decisions (organization_id, qualification_status);

-- RLS: existing tenant policy remains; no cross-org change.
-- Backward compatibility: backfill qualification_status from eligibility_status where possible.
-- Privacy: evidence_json may contain public URLs only — avoid storing full page HTML.
-- Rollback: drop added columns; indexes optional.