-- Candidate matching fields for recruiter intelligence

alter table public.candidates
  add column if not exists candidate_current_role text,
  add column if not exists location text,
  add column if not exists summary text,
  add column if not exists skills jsonb not null default '[]'::jsonb,
  add column if not exists experience_years integer,
  add column if not exists salary_expectation_min integer,
  add column if not exists salary_expectation_max integer,
  add column if not exists availability text,
  add column if not exists owner_id uuid references auth.users (id) on delete set null;

create index if not exists candidates_org_status_idx
  on public.candidates (organization_id, status, updated_at desc);
