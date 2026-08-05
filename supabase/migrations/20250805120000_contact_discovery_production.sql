-- Contact Discovery production fields + tracing for AI Recruiter outreach

alter table public.contacts
  add column if not exists department text,
  add column if not exists source_url text,
  add column if not exists source_type text check (
    source_type is null or source_type in (
      'existing_crm',
      'company_website',
      'tavily_search',
      'linkedin_public',
      'inferred',
      'manual',
      'opencorporates'
    )
  ),
  add column if not exists verification_status text check (
    verification_status is null or verification_status in (
      'verified',
      'likely',
      'catch_all',
      'unknown',
      'invalid'
    )
  ),
  add column if not exists email_origin text check (
    email_origin is null or email_origin in (
      'published',
      'extracted',
      'inferred',
      'existing'
    )
  ),
  add column if not exists is_general_mailbox boolean not null default false,
  add column if not exists is_decision_maker boolean not null default false,
  add column if not exists relevance_score numeric(5, 2),
  add column if not exists outreach_opt_out boolean not null default false,
  add column if not exists opted_out_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists contacts_org_email_unique
  on public.contacts (organization_id, lower(email))
  where email is not null and archived_at is null;

create index if not exists contacts_company_relevance_idx
  on public.contacts (organization_id, company_id, relevance_score desc nulls last);

-- Per-company provider tracing during AI Recruiter contact discovery
create table if not exists public.contact_finder_traces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid,
  run_item_id uuid,
  company_id uuid not null references public.companies (id) on delete cascade,
  company_name text not null,
  company_domain text,
  provider text not null,
  query text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  raw_result_count integer not null default 0,
  normalized_count integer not null default 0,
  valid_count integer not null default 0,
  rejected_count integer not null default 0,
  rejection_reasons jsonb not null default '[]'::jsonb,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contact_finder_traces_org_company_idx
  on public.contact_finder_traces (organization_id, company_id, created_at desc);

alter table public.contact_finder_traces enable row level security;

do $policy$
begin
  execute $sql$
    create policy "contact_finder_traces_tenant"
    on public.contact_finder_traces
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
  when undefined_table then null;
end
$policy$;
