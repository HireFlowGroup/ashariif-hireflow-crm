-- Follow-up: section 6 was added to 20251123103000 after that version was already applied on test.
-- Idempotent GRANT only; RLS policies on organization_provider_configs unchanged.
grant select on table public.organization_provider_configs to authenticated;