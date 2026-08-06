-- Company identity and prospect decision metadata (local migration — do not push remote without review)

alter table public.companies
  add column if not exists official_name text,
  add column if not exists trading_name text,
  add column if not exists legal_name text,
  add column if not exists identity_confidence numeric(4,3),
  add column if not exists identity_source text,
  add column if not exists identity_evidence jsonb not null default '[]'::jsonb,
  add column if not exists business_classification text,
  add column if not exists classification_confidence numeric(4,3),
  add column if not exists classification_reasons jsonb not null default '[]'::jsonb,
  add column if not exists identity_resolved_at timestamptz;

alter table public.ai_recruiter_run_items
  add column if not exists decision text,
  add column if not exists decision_reason text,
  add column if not exists priority text,
  add column if not exists scoring_version text,
  add column if not exists evaluated_at timestamptz;

create index if not exists companies_business_classification_idx
  on public.companies (organization_id, business_classification)
  where business_classification is not null;
