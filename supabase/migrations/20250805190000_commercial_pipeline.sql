-- Commercial BD pipeline — AI Business Development platform (not CRM)

create table if not exists public.commercial_pipeline_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  stage text not null default 'nieuw',
  position integer not null default 0,
  company_name text not null,
  sector text,
  city text,
  contact_name text,
  contact_email text,
  lead_score integer,
  deal_value numeric(12, 2),
  notes text,
  source_run_item_id uuid,
  lost_reason text,
  moved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_pipeline_cards_stage_check check (
    stage in (
      'nieuw',
      'geanalyseerd',
      'mail_klaar',
      'mail_verzonden',
      'reactie_ontvangen',
      'interesse',
      'intake_gepland',
      'vacature_ontvangen',
      'kandidaten_zoeken',
      'voorstellen_gedaan',
      'interview',
      'plaatsing',
      'verloren'
    )
  )
);

create unique index if not exists commercial_pipeline_cards_org_company_idx
  on public.commercial_pipeline_cards (organization_id, company_id);

create index if not exists commercial_pipeline_cards_org_stage_position_idx
  on public.commercial_pipeline_cards (organization_id, stage, position);

alter table public.commercial_pipeline_cards enable row level security;

do $policy$
begin
  create policy commercial_pipeline_cards_tenant
    on public.commercial_pipeline_cards
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id());
exception
  when duplicate_object then null;
end
$policy$;

comment on table public.commercial_pipeline_cards is
  'Commercial BD pipeline cards — AI Business Development platform, not CRM.';
