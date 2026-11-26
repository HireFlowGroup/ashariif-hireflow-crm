import type { AiRecruiterRunCounters } from "@/features/ai-recruiter/domain/types";
import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import {
  createEmptyPipelineFunnelDiagnostics,
  type PipelineFunnelDiagnostics,
} from "@/features/ai-recruiter/domain/pipeline-funnel-diagnostics.types";
import type { DiscoveryEventSummary } from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";
import type { ProviderRequestTelemetry } from "@/features/ai-recruiter/services/provider-request-telemetry.service";
import { resolveProviderRequestsCount } from "@/features/ai-recruiter/services/provider-request-telemetry.service";
import type { ProviderDegradedModeReport } from "@/features/company-finder/discovery/provider-degraded-mode.service";

export function buildPipelineFunnelDiagnostics(input: {
  discoverySummary: DiscoveryEventSummary;
  counters: AiRecruiterRunCounters;
  eligibilityDecisions: ConceptEligibilityResult[];
  enrichmentAttempts: number;
  conceptsCreated: number;
  deferredBeyondCap?: number;
  providerFailoverCount?: number;
  searchQueries?: number;
  providerTelemetry?: ProviderRequestTelemetry | null;
  websiteFetches?: number;
  enrichmentProviderCalls?: number;
  providerDegradedMode?: ProviderDegradedModeReport | null;
}): PipelineFunnelDiagnostics {
  const eligible = input.eligibilityDecisions.filter((d) => d.qualificationStatus === "eligible").length;
  const needsEvidence = input.eligibilityDecisions.filter((d) => d.qualificationStatus === "needs_evidence").length;
  const rejected = input.eligibilityDecisions.filter((d) => d.qualificationStatus === "rejected").length;

  const telemetry = input.providerTelemetry
    ? {
        ...input.providerTelemetry,
        websiteFetches:
          input.websiteFetches ?? input.providerTelemetry.websiteFetches,
        enrichmentProviderCalls:
          input.enrichmentProviderCalls ?? input.providerTelemetry.enrichmentProviderCalls,
        totalBillableUnits:
          (input.providerTelemetry.providerAttempts ?? 0)
          + (input.websiteFetches ?? input.providerTelemetry.websiteFetches ?? 0)
          + (input.enrichmentProviderCalls ?? input.providerTelemetry.enrichmentProviderCalls ?? 0),
      }
    : null;

  const providerRequests = telemetry
    ? resolveProviderRequestsCount(telemetry)
    : input.discoverySummary.responseCount > 0
      ? 1
      : 0;

  const searchQueries =
    input.searchQueries
    ?? telemetry?.searchQueriesExecuted
    ?? 0;

  const failoverCount =
    input.providerFailoverCount
    ?? telemetry?.failoverEvents
    ?? 0;

  return createEmptyPipelineFunnelDiagnostics({
    searchQueries,
    providerRequests,
    searchResultsReceived: input.discoverySummary.responseCount,
    uniqueCompanies: input.counters.validated,
    duplicateCompanies: Math.max(0, input.counters.found - input.counters.validated),
    investigatedProspects: input.eligibilityDecisions.length,
    enrichmentAttempts: input.enrichmentAttempts,
    eligibleProspects: eligible,
    needsEvidenceProspects: needsEvidence,
    rejectedProspects: rejected,
    savedCompanies: input.counters.validated,
    concepts: input.conceptsCreated,
    deferredBeyondCap: input.deferredBeyondCap ?? 0,
    providerUsed: input.discoverySummary.providerName,
    providerFailoverCount: failoverCount,
    providerTelemetry: telemetry ?? undefined,
    providerDegradedMode: input.providerDegradedMode ?? undefined,
    version: telemetry ? "p0-r31-v1" : "p0-r3-v1",
  });
}