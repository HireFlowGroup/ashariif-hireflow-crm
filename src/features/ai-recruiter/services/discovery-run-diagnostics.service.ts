import type { CompanySearchJob } from "@/features/company-finder/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  createEmptyRunDiagnostics,
  type RunDiagnostics,
  type RunFailureCode,
  runDiagnosticsSchema,
} from "@/features/ai-recruiter/domain/run-diagnostics";
import { getTavilyApiKey } from "@/features/lead-intelligence/providers/manager/provider-env";
import {
  buildRequestCriteriaFromPlan,
  classifyProviderError,
  type DiscoveryEventSummary,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";

export type { DiscoveryEventSummary } from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";
export {
  buildRequestCriteriaFromPlan,
  buildRunFailureUiMessage,
  classifyProviderError,
  emptyDiscoverySummary,
  isProviderFailure,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";

export function resolveProviderAvailability(providerName: string | null): boolean | null {
  if (!providerName) return null;
  if (providerName === "tavily") return Boolean(getTavilyApiKey());
  return true;
}

export function buildDiscoveryDiagnostics(input: {
  plan: AiRecruiterSearchPlan;
  job: CompanySearchJob | null;
  summary: DiscoveryEventSummary;
  durationMs: number;
  validatedCount: number;
}): RunDiagnostics {
  const base = createEmptyRunDiagnostics(buildRequestCriteriaFromPlan(input.plan));
  const providerName = input.summary.providerName ?? input.job?.providerErrors?.[0]?.provider ?? "tavily";
  const discoveryAttempted =
    input.job != null
    || input.summary.lastErrorMessage != null
    || input.summary.responseCount > 0
    || input.durationMs > 0;
  const providerActive = discoveryAttempted
    ? true
    : resolveProviderAvailability(providerName);

  let errorCode: RunFailureCode | null = null;
  let errorMessage: string | null = null;
  let retryRecommended = false;

  const responseCount = input.summary.responseCount || input.job?.foundCount || 0;
  const normalizedCount = input.summary.normalizedCount || input.summary.realCompanies;
  const rejectedCount = input.summary.rejectedCount || input.summary.qualityReportRejected || input.job?.skippedCount || 0;

  if (!providerActive) {
    errorCode = "provider_not_configured";
    errorMessage = `${providerName ?? "Zoekprovider"} is niet geconfigureerd (API-key ontbreekt).`;
    retryRecommended = false;
  } else if (input.summary.lastErrorMessage) {
    errorMessage = input.summary.lastErrorMessage;
    errorCode = classifyProviderError(errorMessage);
    retryRecommended = errorCode === "provider_rate_limited" || errorCode === "provider_timeout";
  } else if (responseCount > 0 && input.validatedCount === 0) {
    errorCode = "no_valid_companies";
    errorMessage =
      rejectedCount > 0
        ? `${rejectedCount} resultaten afgewezen — geen bedrijven voldeden aan de kwaliteitscontrole.`
        : "Er zijn zoekresultaten gevonden, maar geen geldige bedrijven opgeslagen.";
    retryRecommended = true;
  } else if (input.job?.status === "failed" && input.job.errorMessage) {
    errorMessage = input.job.errorMessage;
    errorCode = classifyProviderError(errorMessage);
    retryRecommended = errorCode === "provider_rate_limited" || errorCode === "provider_timeout";
  } else if (responseCount === 0 && input.validatedCount === 0) {
    errorCode = "no_results";
    errorMessage = "De zoekopdracht leverde geen bedrijven op. Pas locatie, branche of zoekwoorden aan.";
    retryRecommended = true;
  }

  return runDiagnosticsSchema.parse({
    ...base,
    errorCode,
    errorMessage,
    providerName,
    providerActive,
    responseCount,
    normalizedCount,
    rejectedCount,
    rejectionReasons: input.summary.rejectionReasons.slice(0, 10),
    durationMs: input.durationMs,
    retryRecommended,
    timestamp: new Date().toISOString(),
  });
}
