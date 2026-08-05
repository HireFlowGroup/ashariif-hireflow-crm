-- HireFlow Outreach Engine — campaigns, messages, events, suppressions
-- Safe-by-default: DRAFT_ONLY enforced in application layer

-- ---------------------------------------------------------------------------
-- Opt-out flags on existing tables
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists outreach_opt_out boolean not null default false;

alter table public.contacts
  add column if not exists outreach_opt_out boolean not null default false;

comment on column public.companies.outreach_opt_out is
  'When true, block all future outreach to this company';

comment on column public.contacts.outreach_opt_out is
  'When true, block outreach to this contact';

-- ---------------------------------------------------------------------------
-- outreach_suppressions — global block list per org
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  reason text,
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists outreach_suppressions_org_email_unique
  on public.outreach_suppressions (
    organization_id,
    lower(email)
  );

-- ---------------------------------------------------------------------------
-- organization_email_connections — OAuth / SMTP sender config (no secrets in logs)
-- ---------------------------------------------------------------------------
create table if not exists public.organization_email_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('gmail', 'smtp')),
  sender_email text not null,
  sender_name text,
  is_verified boolean not null default false,
  is_default boolean not null default false,
  -- Encrypted at rest by application (same pattern as provider vault)
  credentials_encrypted text,
  metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sender_email)
);

-- ---------------------------------------------------------------------------
-- outreach_campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed')),
  sender_name text,
  sender_email text,
  subject_template text,
  body_template text,
  daily_limit integer not null default 10 check (daily_limit > 0 and daily_limit <= 500),
  approval_mode text not null default 'manual'
    check (approval_mode in ('manual', 'automatic')),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_campaigns_org_status_idx
  on public.outreach_campaigns (organization_id, status);

-- ---------------------------------------------------------------------------
-- outreach_messages
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid references public.outreach_campaigns (id) on delete set null,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  recipient_name text,
  recipient_email text not null,
  subject text not null default '',
  body_text text not null default '',
  body_html text,
  status text not null default 'draft'
    check (status in (
      'draft',
      'pending_approval',
      'approved',
      'queued',
      'sending',
      'sent',
      'failed',
      'bounced',
      'replied',
      'cancelled',
      'blocked_missing_recipient'
    )),
  personalization_data jsonb not null default '{}'::jsonb,
  provider text,
  provider_message_id text,
  error_message text,
  idempotency_key text not null,
  retry_count integer not null default 0 check (retry_count >= 0 and retry_count <= 5),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists outreach_messages_org_status_idx
  on public.outreach_messages (organization_id, status, created_at desc);

create index if not exists outreach_messages_org_company_idx
  on public.outreach_messages (organization_id, company_id, sent_at desc nulls last);

create index if not exists outreach_messages_org_recipient_idx
  on public.outreach_messages (organization_id, lower(recipient_email));

-- ---------------------------------------------------------------------------
-- outreach_events — audit trail (no secrets)
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  outreach_message_id uuid not null references public.outreach_messages (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'draft_created',
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
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists outreach_events_message_idx
  on public.outreach_events (outreach_message_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists outreach_campaigns_updated_at on public.outreach_campaigns;
create trigger outreach_campaigns_updated_at
  before update on public.outreach_campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists outreach_messages_updated_at on public.outreach_messages;
create trigger outreach_messages_updated_at
  before update on public.outreach_messages
  for each row execute function public.set_updated_at();

drop trigger if exists organization_email_connections_updated_at on public.organization_email_connections;
create trigger organization_email_connections_updated_at
  before update on public.organization_email_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.outreach_suppressions enable row level security;
alter table public.organization_email_connections enable row level security;
alter table public.outreach_campaigns enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.outreach_events enable row level security;

-- Suppressions
drop policy if exists "outreach_suppressions_tenant" on public.outreach_suppressions;
create policy "outreach_suppressions_tenant"
  on public.outreach_suppressions for all to authenticated
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- Email connections
drop policy if exists "organization_email_connections_tenant" on public.organization_email_connections;
create policy "organization_email_connections_tenant"
  on public.organization_email_connections for all to authenticated
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- Campaigns
drop policy if exists "outreach_campaigns_tenant" on public.outreach_campaigns;
create policy "outreach_campaigns_tenant"
  on public.outreach_campaigns for all to authenticated
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- Messages
drop policy if exists "outreach_messages_tenant" on public.outreach_messages;
create policy "outreach_messages_tenant"
  on public.outreach_messages for all to authenticated
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- Events
drop policy if exists "outreach_events_tenant" on public.outreach_events;
create policy "outreach_events_tenant"
  on public.outreach_events for all to authenticated
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

grant select, insert, update, delete on public.outreach_suppressions to authenticated;
grant select, insert, update, delete on public.organization_email_connections to authenticated;
grant select, insert, update, delete on public.outreach_campaigns to authenticated;
grant select, insert, update, delete on public.outreach_messages to authenticated;
grant select, insert, delete on public.outreach_events to authenticated;
