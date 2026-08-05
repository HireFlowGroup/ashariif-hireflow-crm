import type { AiRecruiterRunCounters, AiRecruiterRunStatus } from "@/features/ai-recruiter/domain/types";
import type { RunDiagnostics, RunFailureCode } from "@/features/ai-recruiter/domain/run-diagnostics";
import { isProviderFailure } from "@/features/ai-recruiter/services/discovery-run-diagnostics.service";
import type { EligibilityRunSummary } from "@/features/ai-recruiter/services/prospect-eligibility-pipeline.service";

export type RunOutcome = {
  status: AiRecruiterRunStatus;
  errorMessage: string | null;
};

export function resolveRunOutcome(input: {
  counters: AiRecruiterRunCounters;
  diagnostics: RunDiagnostics;
  draftsCreated: number;
  eligibilitySummary?: EligibilityRunSummary | null;
}): RunOutcome {
  const { counters, diagnostics, draftsCreated, eligibilitySummary } = input;

  if (isProviderFailure(diagnostics.errorCode)) {
    return {
      status: "failed",
      errorMessage: diagnostics.errorMessage,
    };
  }

  if (draftsCreated > 0 && counters.failed > 0) {
    return {
      status: "partially_completed",
      errorMessage: null,
    };
  }

  if (draftsCreated > 0) {
    return {
      status: "awaiting_approval",
      errorMessage: null,
    };
  }

  if (counters.validated > 0) {
    const summaryParts = eligibilitySummary
      ? [
          `${eligibilitySummary.prospectsReviewed} prospects beoordeeld`,
          `gem. score ${eligibilitySummary.averageScore}`,
          `drempel ${eligibilitySummary.threshold}`,
          eligibilitySummary.topRejectionReasons[0]
            ? `top afwijsreden: ${eligibilitySummary.topRejectionReasons[0].reason} (${eligibilitySummary.topRejectionReasons[0].count}x)`
            : null,
        ].filter(Boolean).join(" · ")
      : null;

    return {
      status: "partially_completed",
      errorMessage: summaryParts
        ? `Geen concepten aangemaakt — ${summaryParts}.`
        : "Geen concepten aangemaakt — geen eligible prospects na contact- en scoredrempels.",
    };
  }

  if (diagnostics.errorCode === "no_results" || diagnostics.errorCode === "no_valid_companies") {
    return {
      status: "failed",
      errorMessage: diagnostics.errorMessage,
    };
  }

  if (diagnostics.errorCode === "database_error") {
    return {
      status: "failed",
      errorMessage: diagnostics.errorMessage,
    };
  }

  return {
    status: "failed",
    errorMessage: diagnostics.errorMessage ?? "Geen geschikte prospects gevonden.",
  };
}

export function discoveryStepFailed(errorCode: RunFailureCode | null): boolean {
  return isProviderFailure(errorCode) || errorCode === "database_error" || errorCode === "unknown_error";
}
