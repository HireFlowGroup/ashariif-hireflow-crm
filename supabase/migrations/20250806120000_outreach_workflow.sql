-- Outreach workflow: draft versions, follow-ups, extended message fields
-- Local migration only — do not run remotely without review

-- ---------------------------------------------------------------------------
-- Extend outreach_messages
-- ---------------------------------------------------------------------------
alter table public.outreach_messages
  add column if not exists run_id uuid,
  add column if not exists vacancy_id uuid references public.vacancies (id) on delete set null,
  add column if not exists personalization_facts jsonb not null default '[]'::jsonb,
  add column if not exists source_evidence jsonb not null default '[]'::jsonb,
  add column if not exists outreach_warnings text[] not null default '{}',
  add column if not exists opportunity_score integer,
  add column if not exists prompt_version text,
  add column if not exists model text,
  add column if not exists intent text not null default 'permission_to_source_candidates',
  add column if not exists active_version_id uuid,
  add column if not exists failure_code text,
  add column if not exists reply_to text;

-- Map needs_review to pending_approval in application; add rejected status alias
alter table public.outreach_messages
  drop constraint if exists outreach_messages_status_check;

alter table public.outreach_messages
  add constraint outreach_messages_status_check
  check (status in (
    'draft',
    'needs_review',
    'pending_approval',
    'approved',
    'rejected',
    'queued',
    'sending',
    'sent',
    'failed',
    'bounced',
    'replied',
    'cancelled',
    'blocked_missing_recipient'
  ));

create index if not exists outreach_messages_org_run_idx
  on public.outreach_messages (organization_id, run_id, created_at desc);

create index if not exists outreach_messages_org_vacancy_recipient_idx
  on public.outreach_messages (organization_id, vacancy_id, lower(recipient_email), created_at desc);

create unique index if not exists outreach_messages_active_draft_unique
  on public.outreach_messages (organization_id, company_id, coalesce(vacancy_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(recipient_email))
  where status in ('draft', 'needs_review', 'pending_approval', 'approved', 'queued', 'sending');

-- ---------------------------------------------------------------------------
-- outreach_draft_versions
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_draft_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  outreach_message_id uuid not null references public.outreach_messages (id) on delete cascade,
  parent_draft_id uuid references public.outreach_draft_versions (id) on delete set null,
  version_number integer not null check (version_number > 0),
  variant_type text not null default 'default'
    check (variant_type in ('default', 'shorter', 'personal', 'formal', 'direct')),
  subject text not null default '',
  body_text text not null default '',
  salutation text,
  cta text,
  closing text,
  personalization_facts jsonb not null default '[]'::jsonb,
  source_evidence jsonb not null default '[]'::jsonb,
  warnings text[] not null default '{}',
  confidence numeric(4, 3),
  model text,
  prompt_version text,
  generated_by uuid references auth.users (id) on delete set null,
  generated_at timestamptz not null default now(),
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists outreach_draft_versions_message_version_unique
  on public.outreach_draft_versions (outreach_message_id, version_number);

create index if not exists outreach_draft_versions_message_selected_idx
  on public.outreach_draft_versions (outreach_message_id, is_selected);

-- ---------------------------------------------------------------------------
-- outreach_followups — planning only (no auto-send)
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  outreach_message_id uuid not null references public.outreach_messages (id) on delete cascade,
  sequence_number integer not null check (sequence_number between 1 and 5),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled'
    check (status in (
      'scheduled',
      'cancelled',
      'due',
      'sent',
      'skipped_reply_received',
      'skipped_opt_out',
      'failed'
    )),
  draft_subject text,
  draft_body_text text,
  sent_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_followups_org_status_scheduled_idx
  on public.outreach_followups (organization_id, status, scheduled_for);

-- ---------------------------------------------------------------------------
-- Extend outreach_events event types
-- ---------------------------------------------------------------------------
alter table public.outreach_events
  drop constraint if exists outreach_events_event_type_check;

alter table public.outreach_events
  add constraint outreach_events_event_type_check
  check (event_type in (
    'draft_created',
    'draft_regenerated',
    'draft_edited',
    'recipient_changed',
    'edited',
    'approved',
    'rejected',
    'queued',
    'send_attempt',
    'sent',
    'failed',
    'bounced',
    'reply',
    'cancelled',
    'test_sent',
    'blocked'
  ));

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------
alter table public.outreach_draft_versions enable row level security;
alter table public.outreach_followups enable row level security;

drop policy if exists "outreach_draft_versions_tenant" on public.outreach_draft_versions;
create policy "outreach_draft_versions_tenant"
  on public.outreach_draft_versions for all to authenticated
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "outreach_followups_tenant" on public.outreach_followups;
create policy "outreach_followups_tenant"
  on public.outreach_followups for all to authenticated
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

grant select, insert, update, delete on public.outreach_draft_versions to authenticated;
grant select, insert, update, delete on public.outreach_followups to authenticated;

drop trigger if exists outreach_followups_updated_at on public.outreach_followups;
create trigger outreach_followups_updated_at
  before update on public.outreach_followups
  for each row execute function public.set_updated_at();
