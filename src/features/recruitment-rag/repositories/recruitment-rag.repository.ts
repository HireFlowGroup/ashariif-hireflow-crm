import type {
  KnowledgeChunkInput,
  RecruitmentKnowledgeChunk,
  RecruitmentKnowledgeEntityType,
} from "@/features/recruitment-rag/domain/types";

export class RecruitmentRagRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecruitmentRagRepositoryError";
  }
}

export interface RecruitmentRagRepository {
  upsertChunks(chunks: Array<KnowledgeChunkInput & { embedding: number[]; contentHash: string }>): Promise<number>;

  searchSimilar(
    organizationId: string,
    queryEmbedding: number[],
    matchCount: number,
    entityType?: RecruitmentKnowledgeEntityType,
  ): Promise<RecruitmentKnowledgeChunk[]>;

  getLatestIndexedAt(organizationId: string): Promise<string | null>;
}
