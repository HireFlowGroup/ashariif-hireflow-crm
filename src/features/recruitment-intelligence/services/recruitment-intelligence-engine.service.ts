import type {
  RecruitmentIntelligenceAnalysis,
  RecruitmentIntelligenceRecord,
} from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import type { RecruitmentIntelligenceRepository } from "@/features/recruitment-intelligence/repositories/recruitment-intelligence.repository";
import { generateRecruitmentIntelligence } from "@/features/recruitment-intelligence/services/recruitment-intelligence-generator.service";

export type RecruitmentIntelligenceContext = {
  organizationId: string;
  userId: string;
};

export type RecruitmentIntelligenceResponse = {
  record: RecruitmentIntelligenceRecord | null;
  analysis: RecruitmentIntelligenceAnalysis | null;
  isStale: boolean;
  generatedAt: string;
};

export class RecruitmentIntelligenceEngine {
  constructor(private readonly repository: RecruitmentIntelligenceRepository) {}

  async getAnalysis(
    context: RecruitmentIntelligenceContext,
    companyId: string,
    options?: { generateIfMissing?: boolean },
  ): Promise<RecruitmentIntelligenceResponse> {
    const input = await this.repository.loadInput(context.organizationId, companyId);
    if (!input) {
      return { record: null, analysis: null, isStale: false, generatedAt: new Date().toISOString() };
    }

    const current = await this.repository.getCurrent(context.organizationId, companyId);
    const isStale = !current || current.inputFingerprint !== input.inputFingerprint;

    if (!current && options?.generateIfMissing) {
      const record = await this.ensureFreshAnalysis(context, companyId, { force: true });
      return {
        record,
        analysis: record?.analysis ?? null,
        isStale: false,
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      record: current,
      analysis: current?.analysis ?? null,
      isStale,
      generatedAt: current?.generatedAt ?? new Date().toISOString(),
    };
  }

  async ensureFreshAnalysis(
    context: RecruitmentIntelligenceContext,
    companyId: string,
    options?: { force?: boolean; runItemId?: string | null },
  ): Promise<RecruitmentIntelligenceRecord | null> {
    const input = await this.repository.loadInput(
      context.organizationId,
      companyId,
      options?.runItemId ?? null,
    );
    if (!input) return null;

    const current = await this.repository.getCurrent(context.organizationId, companyId);
    if (!options?.force && current && current.inputFingerprint === input.inputFingerprint) {
      return current;
    }

    const generated = await generateRecruitmentIntelligence(input);

    return this.repository.save(context.organizationId, companyId, {
      analysis: generated.analysis,
      inputFingerprint: input.inputFingerprint,
      model: generated.model,
      runItemId: options?.runItemId ?? input.runItemId,
    });
  }
}
