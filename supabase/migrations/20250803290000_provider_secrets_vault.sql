-- =============================================================================
-- Provider Secrets Vault — org-scoped encrypted API credentials
-- =============================================================================

create table if not exists public.organization_provider_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_id text not null,
  enabled boolean not null default true,
  encrypted_payload text not null,
  secret_fingerprint text not null,
  masked_preview text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_provider_configs_org_provider_unique
    unique (organization_id, provider_id)
);

create index if not exists organization_provider_configs_org_idx
  on public.organization_provider_configs (organization_id);

alter table public.organization_provider_configs enable row level security;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_organization_provider_configs"
    on public.organization_provider_configs
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
end
$policy$;

-- Persisted health snapshots (survives restarts, powers realtime)
create table if not exists public.organization_provider_health (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_id text not null,
  status text not null default 'disabled',
  health_score integer not null default 0,
  requests_today integer not null default 0,
  success_rate integer not null default 100,
  avg_response_ms integer not null default 0,
  quota_remaining integer,
  last_error text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint organization_provider_health_org_provider_unique
    unique (organization_id, provider_id)
);

create index if not exists organization_provider_health_org_idx
  on public.organization_provider_health (organization_id, updated_at desc);

alter table public.organization_provider_health enable row level security;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_organization_provider_health"
    on public.organization_provider_health
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
end
$policy$;

do $realtime$
begin
  alter publication supabase_realtime add table public.organization_provider_health;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$realtime$;

comment on table public.organization_provider_configs is
  'Org-scoped provider API keys (AES-256-GCM encrypted at application layer).';
comment on table public.organization_provider_health is
  'Persisted provider health metrics for dashboards and realtime updates.';
