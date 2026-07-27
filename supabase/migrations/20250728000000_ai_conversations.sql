-- AI conversation history (Sprint 1.4)

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Nieuw gesprek',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tool_name text,
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);

create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at asc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "ai_conversations_own_org"
on public.ai_conversations
for all
using (
  user_id = auth.uid()
  and organization_id = public.current_organization_id()
)
with check (
  user_id = auth.uid()
  and organization_id = public.current_organization_id()
);

create policy "ai_messages_own_conversations"
on public.ai_messages
for all
using (
  organization_id = public.current_organization_id()
  and conversation_id in (
    select id
    from public.ai_conversations
    where user_id = auth.uid()
  )
)
with check (
  organization_id = public.current_organization_id()
  and conversation_id in (
    select id
    from public.ai_conversations
    where user_id = auth.uid()
  )
);
