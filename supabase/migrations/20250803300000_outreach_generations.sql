-- Outreach Generator: versioned multi-channel outreach content per company

create table if not exists public.outreach_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  writing_style text not null check (
    writing_style in ('formal', 'friendly', 'direct', 'consultative')
  ),
  contact_id uuid references public.contacts (id) on delete set null,
  contact_name text,
  primary_signal_id uuid references public.hiring_signals (id) on delete set null,

  content jsonb not null default '{}'::jsonb,
  referenced_signal_ids uuid[] not null default '{}',

  model text,
  model_version text not null default 'outreach-generator-v1',
  is_current boolean not null default true,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists outreach_generations_current_style_uidx
  on public.outreach_generations (organization_id, company_id, writing_style)
  where is_current = true;

create index if not exists outreach_generations_company_idx
  on public.outreach_generations (company_id, generated_at desc);

alter table public.outreach_generations enable row level security;

do $policy$
begin
  execute $sql$
    create policy "outreach_generations_tenant"
    on public.outreach_generations
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception when duplicate_object then null;
end
$policy$;

comment on table public.outreach_generations is
  'AI-generated outreach packages: email, LinkedIn, call script, voicemail, follow-ups.';
