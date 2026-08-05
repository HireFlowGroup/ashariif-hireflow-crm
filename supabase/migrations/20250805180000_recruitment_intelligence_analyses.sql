-- Recruitment Intelligence Engine — structured GPT analyses per company

create table if not exists public.recruitment_intelligence_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  run_item_id uuid references public.ai_recruiter_run_items (id) on delete set null,
  analysis jsonb not null default '{}'::jsonb,
  input_fingerprint text not null default '',
  model text,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruitment_intelligence_analyses_org_company_idx
  on public.recruitment_intelligence_analyses (organization_id, company_id, created_at desc);

create unique index if not exists recruitment_intelligence_analyses_current_idx
  on public.recruitment_intelligence_analyses (organization_id, company_id)
  where is_current = true;

alter table public.recruitment_intelligence_analyses enable row level security;

do $policy$
begin
  create policy recruitment_intelligence_analyses_tenant
    on public.recruitment_intelligence_analyses
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id());
exception
  when duplicate_object then null;
end
$policy$;
