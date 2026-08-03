import type {
  CompanyAnalysisContext,
  CompanyAnalysisRecord,
} from "@/features/company-ai-analysis/domain/analysis.types";

export interface CompanyAnalysisRepository {
  loadContext(organizationId: string, companyId: string): Promise<CompanyAnalysisContext | null>;

  getCurrent(organizationId: string, companyId: string): Promise<CompanyAnalysisRecord | null>;

  save(
    organizationId: string,
    companyId: string,
    input: {
      sections: CompanyAnalysisRecord["sections"];
      dataFingerprint: string;
      model: string | null;
      modelVersion: string;
    },
  ): Promise<CompanyAnalysisRecord>;
}

export class CompanyAnalysisRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyAnalysisRepositoryError";
  }
}
