import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  KnowledgeChunkInput,
  RecruitmentKnowledgeChunk,
  RecruitmentKnowledgeEntityType,
} from "@/features/recruitment-rag/domain/types";
import {
  RecruitmentRagRepositoryError,
  type RecruitmentRagRepository,
} from "@/features/recruitment-rag/repositories/recruitment-rag.repository";
import type { Database } from "@/types/database";

type MatchRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

export class SupabaseRecruitmentRagRepository implements RecruitmentRagRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async upsertChunks(
    chunks: Array<KnowledgeChunkInput & { embedding: number[]; contentHash: string }>,
  ): Promise<number> {
    if (chunks.length === 0) return 0;

    const rows = chunks.map((chunk) => ({
      organization_id: chunk.organizationId,
      entity_type: chunk.entityType,
      entity_id: chunk.entityId,
      title: chunk.title,
      content: chunk.content,
      embedding: JSON.stringify(chunk.embedding),
      metadata: chunk.metadata ?? {},
      content_hash: chunk.contentHash,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.client.from("recruitment_knowledge_chunks").upsert(rows, {
      onConflict: "organization_id,entity_type,entity_id,content_hash",
    });

    if (error) {
      throw new RecruitmentRagRepositoryError(error.message);
    }

    return rows.length;
  }

  async searchSimilar(
    organizationId: string,
    queryEmbedding: number[],
    matchCount: number,
    entityType?: RecruitmentKnowledgeEntityType,
  ): Promise<RecruitmentKnowledgeChunk[]> {
    const { data, error } = await this.client.rpc("match_recruitment_knowledge", {
      p_organization_id: organizationId,
      p_query_embedding: JSON.stringify(queryEmbedding),
      p_match_count: matchCount,
      p_entity_type: entityType ?? null,
    });

    if (error) {
      throw new RecruitmentRagRepositoryError(error.message);
    }

    return ((data ?? []) as MatchRow[]).map((row) => ({
      id: row.id,
      entityType: row.entity_type as RecruitmentKnowledgeEntityType,
      entityId: row.entity_id,
      title: row.title,
      content: row.content,
      metadata: row.metadata ?? {},
      similarity: row.similarity,
    }));
  }

  async getLatestIndexedAt(organizationId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("recruitment_knowledge_chunks")
      .select("updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01") return null;
      throw new RecruitmentRagRepositoryError(error.message);
    }

    return (data?.updated_at as string | undefined) ?? null;
  }
}
