-- =============================================================================
-- HireFlow AI — Enterprise Platform Layer
-- ai_tool_logs (audit), platform_events (realtime/CQRS read models)
-- =============================================================================

create table if not exists public.ai_tool_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  tool_name text not null,
  tool_input jsonb not null default '{}'::jsonb,
  tool_output jsonb,
  success boolean not null default false,
  duration_ms integer not null default 0,
  error_message text,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists ai_tool_logs_org_created_idx
  on public.ai_tool_logs (organization_id, created_at desc);

create index if not exists ai_tool_logs_tool_name_idx
  on public.ai_tool_logs (organization_id, tool_name);

alter table public.ai_tool_logs enable row level security;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_ai_tool_logs"
    on public.ai_tool_logs
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
end
$policy$;

-- Domain events for realtime dashboards, audit trail, CQRS projections
create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_events_org_type_idx
  on public.platform_events (organization_id, event_type, occurred_at desc);

create index if not exists platform_events_aggregate_idx
  on public.platform_events (organization_id, aggregate_type, aggregate_id);

alter table public.platform_events enable row level security;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_platform_events"
    on public.platform_events
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
end
$policy$;

comment on table public.ai_tool_logs is 'Audit trail for AI tool executions (compliance + debugging).';
comment on table public.platform_events is 'Domain events for realtime UI and CQRS read-model projections.';
