-- =============================================================================
-- HireFlow AI — Outreach Intelligence Engine
-- =============================================================================

create table if not exists public.outreach_intelligence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  outreach_id uuid references public.outreach (id) on delete set null,

  recommended_contact_id uuid references public.contacts (id) on delete set null,
  recommended_contact_name text,
  recommended_contact_role text,
  contact_score integer not null default 0 check (contact_score >= 0 and contact_score <= 100),
  contact_reason text,

  recommended_channel text not null default 'email' check (
    recommended_channel in ('email', 'linkedin', 'phone')
  ),
  channel_score_email integer not null default 0 check (channel_score_email >= 0 and channel_score_email <= 100),
  channel_score_linkedin integer not null default 0 check (channel_score_linkedin >= 0 and channel_score_linkedin <= 100),
  channel_score_phone integer not null default 0 check (channel_score_phone >= 0 and channel_score_phone <= 100),
  channel_reason text,

  recommended_moment_at timestamptz,
  recommended_moment_label text,
  timing_reason text,

  outreach_score integer not null default 0 check (outreach_score >= 0 and outreach_score <= 100),
  response_probability integer not null default 0 check (response_probability >= 0 and response_probability <= 100),
  score_breakdown jsonb not null default '{}'::jsonb,

  draft_subject text,
  draft_body text,
  follow_up_subject text,
  follow_up_body text,
  follow_up_scheduled_at timestamptz,

  hiring_signal_id uuid references public.hiring_signals (id) on delete set null,
  ai_summary_id uuid references public.ai_summaries (id) on delete set null,

  model text,
  is_current boolean not null default true,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outreach_intelligence_current_company_uidx
  on public.outreach_intelligence (organization_id, company_id)
  where is_current = true;

create index if not exists outreach_intelligence_org_score_idx
  on public.outreach_intelligence (organization_id, outreach_score desc);

alter table public.outreach_intelligence enable row level security;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_outreach_intelligence"
    on public.outreach_intelligence
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
end
$policy$;

comment on table public.outreach_intelligence is
  'AI-computed outreach recommendations: contact, channel, timing, drafts, scores.';
