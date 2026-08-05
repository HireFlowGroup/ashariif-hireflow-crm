import type {
  RecruitmentIntelligenceAnalysis,
  RecruitmentIntelligenceInput,
  RecruitmentIntelligenceRecord,
} from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { parseRecruitmentIntelligenceAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.schema";

export interface RecruitmentIntelligenceRepository {
  loadInput(organizationId: string, companyId: string, runItemId?: string | null): Promise<RecruitmentIntelligenceInput | null>;
  getCurrent(organizationId: string, companyId: string): Promise<RecruitmentIntelligenceRecord | null>;
  save(
    organizationId: string,
    companyId: string,
    input: {
      analysis: RecruitmentIntelligenceAnalysis;
      inputFingerprint: string;
      model: string | null;
      runItemId?: string | null;
    },
  ): Promise<RecruitmentIntelligenceRecord>;
}

export class RecruitmentIntelligenceRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecruitmentIntelligenceRepositoryError";
  }
}
