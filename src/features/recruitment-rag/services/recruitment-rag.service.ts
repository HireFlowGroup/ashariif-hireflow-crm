import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  KnowledgeChunkInput,
  RecruitmentKnowledgeSearchResult,
} from "@/features/recruitment-rag/domain/types";
import type { RecruitmentRagRepository } from "@/features/recruitment-rag/repositories/recruitment-rag.repository";
import {
  EmbeddingService,
  hashKnowledgeContent,
} from "@/features/recruitment-rag/services/embedding.service";
import type { Database } from "@/types/database";
import type { CompanyIntelligence } from "@/types/hiring-intelligence";

const INDEX_STALE_MS = 15 * 60 * 1000;
const lastSyncByOrg = new Map<string, number>();

export class RecruitmentRagService {
  constructor(
    private readonly repository: RecruitmentRagRepository,
    private readonly supabase: SupabaseClient<Database>,
    private readonly embeddingService: EmbeddingService = new EmbeddingService(),
  ) {}

  async searchKnowledge(
    organizationId: string,
    query: string,
    matchCount = 10,
  ): Promise<RecruitmentKnowledgeSearchResult> {
    await this.ensureIndex(organizationId);

    const queryEmbedding = await this.embeddingService.embedText(query);
    const chunks = await this.repository.searchSimilar(organizationId, queryEmbedding, matchCount);
    const indexedAt = await this.repository.getLatestIndexedAt(organizationId);

    return {
      query,
      matchCount,
      total: chunks.length,
      chunks,
      dataSource: "recruitment_knowledge_chunks (RAG over HireFlow database)",
      indexedAt,
    };
  }

  async ensureIndex(organizationId: string): Promise<void> {
    const lastSync = lastSyncByOrg.get(organizationId) ?? 0;
    if (Date.now() - lastSync < INDEX_STALE_MS) return;

    try {
      await this.syncOrganizationKnowledge(organizationId);
      lastSyncByOrg.set(organizationId, Date.now());
    } catch {
      // RAG table may not exist until migration is applied — search falls back gracefully
    }
  }

  async syncOrganizationKnowledge(organizationId: string): Promise<number> {
    const inputs: KnowledgeChunkInput[] = [];

    const [companies, vacancies, signals, summaries] = await Promise.all([
      this.loadCompanyChunks(organizationId),
      this.loadVacancyChunks(organizationId),
      this.loadSignalChunks(organizationId),
      this.loadSummaryChunks(organizationId),
    ]);

    inputs.push(...companies, ...vacancies, ...signals, ...summaries);
    if (inputs.length === 0) return 0;

    const embeddings = await this.embeddingService.embedBatch(inputs.map((chunk) => chunk.content));

    const withEmbeddings = inputs.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index] ?? [],
      contentHash: hashKnowledgeContent(chunk.content),
    }));

    return this.repository.upsertChunks(withEmbeddings);
  }

  private async loadCompanyChunks(organizationId: string): Promise<KnowledgeChunkInput[]> {
    const { data, error } = await this.supabase
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .limit(500);

    if (error) return [];

    return ((data ?? []) as CompanyIntelligence[]).map((row) => ({
      organizationId,
      entityType: "company",
      entityId: row.id,
      title: row.name,
      content: [
        `Bedrijf: ${row.name}`,
        row.sector ? `Sector: ${row.sector}` : null,
        row.city ? `Stad: ${row.city}` : null,
        row.website ? `Website: ${row.website}` : null,
        row.current_score !== null ? `Lead score: ${row.current_score}` : null,
        row.current_priority ? `Priority: ${row.current_priority}` : null,
        `Hiring intensity: ${row.hiring_intensity ?? 0}`,
        `Signalen: ${row.signal_count ?? 0}`,
        row.current_ai_summary ? `AI samenvatting: ${row.current_ai_summary}` : null,
        row.current_score_reason ? `Score reden: ${row.current_score_reason}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: {
        companyId: row.id,
        sector: row.sector,
        city: row.city,
        score: row.current_score,
      },
    }));
  }

  private async loadCompanyNameMap(
    organizationId: string,
    companyIds: string[],
  ): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(companyIds.filter(Boolean))];
    const map = new Map<string, string>();
    if (uniqueIds.length === 0) return map;

    const { data } = await this.supabase
      .from("companies")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", uniqueIds);

    for (const row of data ?? []) {
      map.set(row.id as string, row.name as string);
    }

    return map;
  }

  private async loadVacancyChunks(organizationId: string): Promise<KnowledgeChunkInput[]> {
    const { data, error } = await this.supabase
      .from("vacancies")
      .select("id, title, description, location, status, company_id")
      .eq("organization_id", organizationId)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) return [];

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNameMap(
      organizationId,
      rows.map((row) => row.company_id as string),
    );

    return rows.map((row) => {
      const companyName = companyNames.get(row.company_id as string);
      return {
        organizationId,
        entityType: "vacancy" as const,
        entityId: row.id as string,
        title: row.title as string,
        content: [
          `Vacature: ${row.title as string}`,
          companyName ? `Bedrijf: ${companyName}` : null,
          row.location ? `Locatie: ${row.location as string}` : null,
          row.description ? `Omschrijving: ${(row.description as string).slice(0, 1500)}` : null,
          `Status: ${row.status as string}`,
        ]
          .filter(Boolean)
          .join("\n"),
        metadata: {
          companyId: row.company_id,
          vacancyId: row.id,
        },
      };
    });
  }

  private async loadSignalChunks(organizationId: string): Promise<KnowledgeChunkInput[]> {
    const { data, error } = await this.supabase
      .from("hiring_signals")
      .select("id, company_id, signal_type, title, description, observed_at")
      .eq("organization_id", organizationId)
      .order("observed_at", { ascending: false })
      .limit(400);

    if (error) return [];

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNameMap(
      organizationId,
      rows.map((row) => row.company_id as string | null).filter(Boolean) as string[],
    );

    return rows.map((row) => {
      const companyName = row.company_id ? companyNames.get(row.company_id as string) : undefined;
      return {
        organizationId,
        entityType: "hiring_signal" as const,
        entityId: row.id as string,
        title: (row.title as string | null) ?? (row.signal_type as string),
        content: [
          companyName ? `Bedrijf: ${companyName}` : null,
          `Signaal type: ${row.signal_type as string}`,
          row.title ? `Titel: ${row.title as string}` : null,
          row.description ? `Beschrijving: ${(row.description as string).slice(0, 1200)}` : null,
          `Waargenomen: ${row.observed_at as string}`,
        ]
          .filter(Boolean)
          .join("\n"),
        metadata: {
          companyId: row.company_id,
          signalType: row.signal_type,
        },
      };
    });
  }

  private async loadSummaryChunks(organizationId: string): Promise<KnowledgeChunkInput[]> {
    const { data, error } = await this.supabase
      .from("ai_summaries")
      .select("id, company_id, summary_type, content")
      .eq("organization_id", organizationId)
      .eq("is_current", true)
      .limit(200);

    if (error) return [];

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNameMap(
      organizationId,
      rows.map((row) => row.company_id as string),
    );

    return rows.map((row) => {
      const companyName = companyNames.get(row.company_id as string);
      return {
        organizationId,
        entityType: "ai_summary" as const,
        entityId: row.id as string,
        title: `${companyName ?? "Bedrijf"} — ${row.summary_type as string}`,
        content: [
          companyName ? `Bedrijf: ${companyName}` : null,
          `Samenvatting type: ${row.summary_type as string}`,
          `Inhoud: ${(row.content as string).slice(0, 2000)}`,
        ]
          .filter(Boolean)
          .join("\n"),
        metadata: {
          companyId: row.company_id,
          summaryType: row.summary_type,
        },
      };
    });
  }
}
