import "server-only";

import type { CompaniesServiceContext } from "@/features/companies/services/companies.service";
import type { CompanySearchCriteria, ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { enrichRecruitmentCandidate } from "@/features/lead-intelligence/services/recruitment-enrichment.service";
import { classifyAndSummarizeLead } from "@/features/lead-intelligence/services/ai-classifier.service";
import { scoreLeadWithExplanation } from "@/features/lead-scoring/services/lead-scoring.service";
import { withTimeout, getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import { toCompanyId } from "@/features/companies/domain";
import { enterOrganizationContext } from "@/features/provider-vault/server/org-context";
import { triggerCompanyAnalysisRefresh } from "@/features/company-ai-analysis/trigger-company-analysis";
import { logPipelinePhase } from "@/lib/company-finder/pipeline-logger";

/** Non-blocking enrichment + AI + score after discovery save. Failures never block the saved record. */
export function scheduleBackgroundCompanyEnrichment(input: {
  organizationId: string;
  companiesService: CompaniesService;
  context: CompaniesServiceContext;
  companyId: string;
  candidate: ExternalCompanyCandidate;
  searchCriteria: CompanySearchCriteria;
  jobId?: string;
}): void {
  void (async () => {
    const config = getLeadIntelligenceConfig();
    let enrichmentFailed = false;
    let aiFailed = false;

    try {
      enterOrganizationContext(input.organizationId);

      const enrichStarted = Date.now();
      logPipelinePhase({
        phase: "ENRICHMENT",
        provider: "crawler",
        company: input.candidate.name,
        status: "started",
        jobId: input.jobId,
      });

      let enriched = input.candidate;
      try {
        enriched = await withTimeout(
          enrichRecruitmentCandidate(input.candidate, input.searchCriteria, {
            jobId: input.jobId,
            company: input.candidate.name,
          }),
          config.crawlerTimeoutMs,
          `Background crawl ${input.candidate.name}`,
        );
        logPipelinePhase({
          phase: "ENRICHMENT",
          provider: "crawler",
          company: input.candidate.name,
          status: "completed",
          durationMs: Date.now() - enrichStarted,
          jobId: input.jobId,
        });
      } catch (error) {
        enrichmentFailed = true;
        logPipelinePhase({
          phase: "ENRICHMENT",
          provider: "crawler",
          company: input.candidate.name,
          status: "failed",
          durationMs: Date.now() - enrichStarted,
          error,
          jobId: input.jobId,
        });
      }

      const aiStarted = Date.now();
      logPipelinePhase({
        phase: "AI",
        provider: "openai",
        company: input.candidate.name,
        status: "started",
        jobId: input.jobId,
      });

      const aiResult = await withTimeout(
        classifyAndSummarizeLead(enriched, input.searchCriteria),
        config.aiTimeoutMs,
        `Background AI ${input.candidate.name}`,
      ).catch((error) => {
        aiFailed = true;
        logPipelinePhase({
          phase: "AI",
          provider: "openai",
          company: input.candidate.name,
          status: "failed",
          durationMs: Date.now() - aiStarted,
          error,
          jobId: input.jobId,
        });
        return {
          aiSummary: enriched.aiSummary ?? "",
          sector: enriched.sector,
          employeeCountLabel: enriched.employeeCountLabel,
        };
      });

      if (!aiFailed) {
        logPipelinePhase({
          phase: "AI",
          provider: "openai",
          company: input.candidate.name,
          status: "completed",
          durationMs: Date.now() - aiStarted,
          jobId: input.jobId,
        });
      }

      const scored = await scoreLeadWithExplanation(
        { ...enriched, aiSummary: aiResult.aiSummary, sector: aiResult.sector ?? enriched.sector },
        input.searchCriteria,
      );

      await input.companiesService.updateCompany(input.context, toCompanyId(input.companyId), {
        website: enriched.website,
        domain: enriched.domain,
        linkedinUrl: enriched.linkedinUrl,
        email: enriched.generalEmail ?? enriched.hrEmail ?? enriched.email,
        generalEmail: enriched.generalEmail,
        hrEmail: enriched.hrEmail,
        phone: enriched.phone,
        careersUrl: enriched.careersUrl,
        vacancyPageUrl: enriched.vacancyPageUrl,
        vacancyCount: enriched.vacancyCount,
        hiringSignals: enriched.hiringSignals,
        aiSummary: aiResult.aiSummary,
        leadScore: scored.score,
        leadPriority: scored.priority,
        scoreReason: scored.explanation ?? scored.scoreReason,
        scoreBreakdown: scored.components,
        lastVerifiedAt: new Date().toISOString(),
      });

      if (enrichmentFailed || aiFailed) {
        console.warn("[ENRICHMENT] Discovery voltooid. Verrijking deels mislukt.", {
          companyId: input.companyId,
          name: input.candidate.name,
          enrichmentFailed,
          aiFailed,
          jobId: input.jobId ?? null,
        });
      }

      void triggerCompanyAnalysisRefresh({
        organizationId: input.organizationId,
        userId: input.context.userId,
        companyId: input.companyId,
      });
    } catch (error) {
      logPipelinePhase({
        phase: "ENRICHMENT",
        provider: "background",
        company: input.candidate.name,
        status: "failed",
        error,
        jobId: input.jobId,
      });
    }
  })();
}
