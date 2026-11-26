-- P0-R3.2.8 — authenticated read van eigen tenant commit counters (narrow grant, RLS blijft actief)
grant select on table public.ai_recruiter_run_commit_counters to authenticated;