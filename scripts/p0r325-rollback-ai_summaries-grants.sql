-- Rollback P0-R3.2.5 ai_summaries authenticated grants (test project only).
revoke select, insert, update, delete on table public.ai_summaries from authenticated;