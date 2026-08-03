-- =============================================================================
-- HireFlow AI — Recruitment RAG (vector knowledge base over CRM data)
-- =============================================================================

create extension if not exists vector;

create table if not exists public.recruitment_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null check (
    entity_type in ('company', 'vacancy', 'hiring_signal', 'ai_summary')
  ),
  entity_id uuid not null,
  title text,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, entity_id, content_hash)
);

create index if not exists recruitment_knowledge_org_entity_idx
  on public.recruitment_knowledge_chunks (organization_id, entity_type, entity_id);

create index if not exists recruitment_knowledge_embedding_idx
  on public.recruitment_knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.recruitment_knowledge_chunks enable row level security;

do $policy$
begin
  execute $sql$
    create policy "tenant_isolation_recruitment_knowledge"
    on public.recruitment_knowledge_chunks
    for all
    using (organization_id = public.current_organization_id())
    with check (organization_id = public.current_organization_id())
  $sql$;
exception
  when duplicate_object then null;
end
$policy$;

-- Vector similarity search (cosine distance)
create or replace function public.match_recruitment_knowledge(
  p_organization_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 10,
  p_entity_type text default null
)
returns table (
  id uuid,
  entity_type text,
  entity_id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    c.id,
    c.entity_type,
    c.entity_id,
    c.title,
    c.content,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.recruitment_knowledge_chunks c
  where c.organization_id = p_organization_id
    and c.embedding is not null
    and (p_entity_type is null or c.entity_type = p_entity_type)
  order by c.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
end;
$$;

comment on table public.recruitment_knowledge_chunks is
  'RAG chunks over HireFlow CRM data for the Recruitment Assistant.';
