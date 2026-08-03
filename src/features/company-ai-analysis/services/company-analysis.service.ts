import type {
  CompanyAnalysisRecord,
  CompanyAnalysisResponse,
} from "@/features/company-ai-analysis/domain/analysis.types";
import type { CompanyAnalysisRepository } from "@/features/company-ai-analysis/repositories/company-analysis.repository";
import { COMPANY_ANALYSIS_MODEL_VERSION } from "@/features/company-ai-analysis/repositories/supabase-company-analysis.repository";
import { generateCompanyAnalysis } from "@/features/company-ai-analysis/services/company-analysis-generator.service";
import type { AuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export class CompanyAnalysisService {
  constructor(private readonly repository: CompanyAnalysisRepository) {}

  async getAnalysis(
    context: AuthenticatedServiceContext,
    companyId: string,
    options?: { generateIfMissing?: boolean },
  ): Promise<CompanyAnalysisResponse> {
    const analysisContext = await this.repository.loadContext(context.organizationId, companyId);

    if (!analysisContext) {
      return {
        analysis: null,
        isStale: false,
        generatedAt: new Date().toISOString(),
      };
    }

    const current = await this.repository.getCurrent(context.organizationId, companyId);
    const isStale = !current || current.dataFingerprint !== analysisContext.dataFingerprint;

    if (!current && options?.generateIfMissing) {
      const generated = await this.ensureFreshAnalysis(context, companyId, { force: true });
      return {
        analysis: generated,
        isStale: false,
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      analysis: current,
      isStale,
      generatedAt: new Date().toISOString(),
    };
  }

  async ensureFreshAnalysis(
    context: AuthenticatedServiceContext,
    companyId: string,
    options?: { force?: boolean },
  ): Promise<CompanyAnalysisRecord | null> {
    const analysisContext = await this.repository.loadContext(context.organizationId, companyId);

    if (!analysisContext) return null;

    const current = await this.repository.getCurrent(context.organizationId, companyId);

    if (!options?.force && current && current.dataFingerprint === analysisContext.dataFingerprint) {
      return current;
    }

    const generated = await generateCompanyAnalysis(analysisContext);

    return this.repository.save(context.organizationId, companyId, {
      sections: generated.sections,
      dataFingerprint: analysisContext.dataFingerprint,
      model: generated.model,
      modelVersion: COMPANY_ANALYSIS_MODEL_VERSION,
    });
  }
}
