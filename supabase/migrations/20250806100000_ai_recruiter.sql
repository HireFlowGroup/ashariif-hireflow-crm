-- HireFlow AI Recruiter — runs, run items, pipeline audit
-- Safe-by-default: manual approval, no auto-send

-- ---------------------------------------------------------------------------
-- ai_recruiter_runs
-- ---------------------------------------------------------------------------
create table if not exists public.ai_recruiter_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  name text not null,
  prompt text not null default '',
  status text not null default 'draft'
    check (status in (
      'draft',
      'queued',
      'discovering',
      'enriching',
      'scoring',
      'finding_contacts',
      'drafting',
      'awaiting_approval',
      'sending',
      'completed',
      'partially_completed',
      'failed',
      'cancelled'
    )),
  search_criteria jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  counters jsonb not null default '{}'::jsonb,
  pipeline_steps jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_recruiter_runs_org_status_idx
  on public.ai_recruiter_runs (organization_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_recruiter_run_items
-- ---------------------------------------------------------------------------
create table if not exists public.ai_recruiter_run_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid not null references public.ai_recruiter_runs (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  external_company_data jsonb not null default '{}'::jsonb,
  stage text not null default 'discovered'
    check (stage in (
      'discovered',
      'validated',
      'enriched',
      'scored',
      'contact_found',
      'draft_created',
      'approved',
      'sent',
      'rejected',
      'skipped'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'skipped')),
  discovery_score numeric(5,2),
  hiring_score numeric(5,2),
  contact_score numeric(5,2),
  outreach_score numeric(5,2),
  total_score numeric(5,2),
  score_breakdown jsonb not null default '{}'::jsonb,
  rejection_reason text,
  warnings jsonb not null default '[]'::jsonb,
  selected_contact_id uuid references public.contacts (id) on delete set null,
  outreach_message_id uuid references public.outreach_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_recruiter_run_items_run_idx
  on public.ai_recruiter_run_items (run_id, stage);

create index if not exists ai_recruiter_run_items_org_company_idx
  on public.ai_recruiter_run_items (organization_id, company_id);

-- ---------------------------------------------------------------------------
-- ai_recruiter_replies — reply classification & follow-up
-- ---------------------------------------------------------------------------
create table if not exists public.ai_recruiter_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  outreach_message_id uuid not null references public.outreach_messages (id) on delete cascade,
  run_item_id uuid references public.ai_recruiter_run_items (id) on delete set null,
  classification text not null
    check (classification in (
      'positive',
      'interested_later',
      'referral',
      'not_interested',
      'unsubscribe',
      'out_of_office',
      'bounce',
      'unknown'
    )),
  reply_subject text,
  reply_snippet text,
  metadata jsonb not null default '{}'::jsonb,
  task_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists ai_recruiter_replies_message_idx
  on public.ai_recruiter_replies (outreach_message_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists ai_recruiter_runs_updated_at on public.ai_recruiter_runs;
create trigger ai_recruiter_runs_updated_at
  before update on public.ai_recruiter_runs
  for each row execute function public.set_updated_at();

drop trigger if exists ai_recruiter_run_items_updated_at on public.ai_recruiter_run_items;
create trigger ai_recruiter_run_items_updated_at
  before update on public.ai_recruiter_run_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ai_recruiter_runs enable row level security;
alter table public.ai_recruiter_run_items enable row level security;
alter table public.ai_recruiter_replies enable row level security;

do $policy$
begin
  create policy tenant_isolation_ai_recruiter_runs on public.ai_recruiter_runs
    for all using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id());
exception when duplicate_object then null;
end $policy$;

do $policy$
begin
  create policy tenant_isolation_ai_recruiter_run_items on public.ai_recruiter_run_items
    for all using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id());
exception when duplicate_object then null;
end $policy$;

do $policy$
begin
  create policy tenant_isolation_ai_recruiter_replies on public.ai_recruiter_replies
    for all using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id());
exception when duplicate_object then null;
end $policy$;
