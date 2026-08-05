import type { CompanySearchJob } from "@/features/company-finder/domain";
import type { CompanyFinderRunEvent } from "@/features/company-finder/services/company-finder.service";
import type { AiRecruiterRun, AiRecruiterRunSettings } from "@/features/ai-recruiter/domain/types";
import type { RunDiagnostics } from "@/features/ai-recruiter/domain/run-diagnostics";
import type { RecruiterPipelineTracker } from "@/features/ai-recruiter/services/recruiter-pipeline-tracker";
import {
  type DiscoveryEventSummary,
  emptyDiscoverySummary,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.service";

export function mergeDiscoveryEvent(
  summary: DiscoveryEventSummary,
  event: CompanyFinderRunEvent,
): DiscoveryEventSummary {
  const next = { ...summary };

  if (event.type === "error") {
    next.lastErrorMessage = event.message;
    return next;
  }

  if (event.type === "event" && event.eventType === "discovery_preview") {
    const payload = event.payload as {
      count?: number;
      provider?: string;
      totalUrls?: number;
      rejected?: number;
    };
    next.providerName = payload.provider ?? next.providerName ?? "tavily";
    next.responseCount = payload.totalUrls ?? payload.count ?? next.responseCount;
    next.normalizedCount = payload.count ?? next.normalizedCount;
    next.rejectedCount = payload.rejected ?? next.rejectedCount;
    return next;
  }

  if (event.type === "event" && event.eventType === "discovery_quality_report") {
    const payload = event.payload as {
      totalUrls?: number;
      rejected?: number;
      realCompanies?: number;
      rejectedByHeuristics?: number;
      rejectedByAiCategory?: number;
    };
    next.responseCount = payload.totalUrls ?? next.responseCount;
    next.rejectedCount = payload.rejected ?? next.rejectedCount;
    next.qualityReportRejected = payload.rejected ?? next.qualityReportRejected;
    next.realCompanies = payload.realCompanies ?? next.realCompanies;

    const reasons: string[] = [];
    if ((payload.rejectedByHeuristics ?? 0) > 0) {
      reasons.push(`${payload.rejectedByHeuristics} afgewezen door heuristieken`);
    }
    if ((payload.rejectedByAiCategory ?? 0) > 0) {
      reasons.push(`${payload.rejectedByAiCategory} afgewezen door AI-categorisatie`);
    }
    if ((payload.rejected ?? 0) > 0 && reasons.length === 0) {
      reasons.push(`${payload.rejected} URLs afgewezen in kwaliteitscontrole`);
    }
    next.rejectionReasons = [...next.rejectionReasons, ...reasons];
    return next;
  }

  return next;
}

export function skipEnrichmentAndDownstream(
  pipeline: RecruiterPipelineTracker,
  message: string,
): void {
  pipeline.skipStep("crawler", "Niet gebruikt in AI Recruiter fast mode");
  pipeline.skipStep("ai_analysis", "Niet gebruikt in AI Recruiter fast mode");
  pipeline.skipStep("vacancies", message);
  pipeline.skipStep("hiring_signals", message);
  pipeline.skipStep("contact_finder", message);
  pipeline.skipStep("lead_score", message);
  pipeline.skipStep("drafts", message);
  pipeline.skipStep("approval", message);
  pipeline.skipStep("sending", "Handmatige goedkeuring vereist");
  pipeline.skipStep("follow_up", "Na verzending");
}

export function buildRunSettingsWithDiagnostics(
  settings: AiRecruiterRunSettings,
  diagnostics: RunDiagnostics,
  finderJobId?: string,
): AiRecruiterRunSettings {
  return {
    ...settings,
    runDiagnostics: diagnostics,
    ...(finderJobId ? { finderJobId } : {}),
  };
}

export function createDiscoverySummarySeed(): DiscoveryEventSummary {
  return emptyDiscoverySummary();
}

export type DiscoveryPhaseResult = {
  summary: DiscoveryEventSummary;
  job: CompanySearchJob | null;
  durationMs: number;
};

export function emptyDiscoveryPhaseResult(durationMs = 0): DiscoveryPhaseResult {
  return {
    summary: emptyDiscoverySummary(),
    job: null,
    durationMs,
  };
}

export function isTerminalRunStatus(status: AiRecruiterRun["status"]): boolean {
  return ["completed", "partially_completed", "failed", "cancelled", "awaiting_approval"].includes(status);
}
