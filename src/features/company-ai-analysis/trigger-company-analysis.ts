import { createCompanyAnalysisService } from "@/features/company-ai-analysis/create-company-analysis-service";
import { pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";

export async function triggerCompanyAnalysisRefresh(params: {
  organizationId: string;
  userId: string;
  companyId: string;
  force?: boolean;
}): Promise<void> {
  try {
    const service = await createCompanyAnalysisService();
    await service.ensureFreshAnalysis(
      { organizationId: params.organizationId, userId: params.userId },
      params.companyId,
      { force: params.force },
    );
  } catch (error) {
    pipelineWarn("company-analysis.trigger.failed", {
      companyId: params.companyId,
      message: error instanceof Error ? error.message : "Onbekende fout",
    });
  }
}
