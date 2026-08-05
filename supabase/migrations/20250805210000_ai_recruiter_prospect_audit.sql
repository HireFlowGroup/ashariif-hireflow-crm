-- AI Recruiter prospect audit trail — per-prospect eligibility and concept decisions

create table if not exists public.ai_recruiter_prospect_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid not null references public.ai_recruiter_runs (id) on delete cascade,
  run_item_id uuid not null references public.ai_recruiter_run_items (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  company_name text not null,
  company_domain text,
  source_url text,
  source_type text,
  vacancy_title text,
  vacancy_url text,
  vacancy_source text,
  location text,
  sector text,
  employee_range text,
  company_validation_status text,
  vacancy_validation_status text,
  contact_type text,
  contact_email text,
  contact_verification_status text,
  contact_score integer,
  opportunity_score integer,
  deterministic_score integer,
  eligibility_status text not null default 'ineligible',
  concept_status text not null default 'pending',
  accepted_rules jsonb not null default '[]'::jsonb,
  rejected_rules jsonb not null default '[]'::jsonb,
  final_decision text not null,
  final_reason text not null,
  reason_code text,
  manual_eligibility_override boolean not null default false,
  vacancy_evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_recruiter_prospect_decisions_run_item_unique
  on public.ai_recruiter_prospect_decisions (run_item_id);

create index if not exists ai_recruiter_prospect_decisions_org_run_idx
  on public.ai_recruiter_prospect_decisions (organization_id, run_id);

create index if not exists ai_recruiter_prospect_decisions_run_item_idx
  on public.ai_recruiter_prospect_decisions (run_item_id);

create index if not exists ai_recruiter_prospect_decisions_eligibility_idx
  on public.ai_recruiter_prospect_decisions (organization_id, eligibility_status);

alter table public.ai_recruiter_prospect_decisions enable row level security;

do $$
begin
  create policy ai_recruiter_prospect_decisions_tenant
    on public.ai_recruiter_prospect_decisions
    for all
    using (organization_id = (select organization_id from public.profiles where id = auth.uid()))
    with check (organization_id = (select organization_id from public.profiles where id = auth.uid()));
exception
  when duplicate_object then null;
end $$;

comment on table public.ai_recruiter_prospect_decisions is
  'Per-prospect audit trail for AI Recruiter eligibility and concept generation decisions.';
