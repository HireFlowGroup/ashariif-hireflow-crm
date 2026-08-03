export type RecruitmentKnowledgeEntityType = "company" | "vacancy" | "hiring_signal" | "ai_summary";

export type RecruitmentKnowledgeChunk = {
  id: string;
  entityType: RecruitmentKnowledgeEntityType;
  entityId: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type RecruitmentKnowledgeSearchResult = {
  query: string;
  matchCount: number;
  total: number;
  chunks: RecruitmentKnowledgeChunk[];
  dataSource: string;
  indexedAt: string | null;
};

export type KnowledgeChunkInput = {
  organizationId: string;
  entityType: RecruitmentKnowledgeEntityType;
  entityId: string;
  title: string | null;
  content: string;
  metadata?: Record<string, unknown>;
};
