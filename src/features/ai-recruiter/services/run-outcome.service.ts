import type { AiRecruiterRunCounters, AiRecruiterRunStatus } from "@/features/ai-recruiter/domain/types";
import type { RunDiagnostics, RunFailureCode } from "@/features/ai-recruiter/domain/run-diagnostics";
import { isProviderFailure } from "@/features/ai-recruiter/services/discovery-run-diagnostics.service";

export type RunOutcome = {
  status: AiRecruiterRunStatus;
  errorMessage: string | null;
};

export function resolveRunOutcome(input: {
  counters: AiRecruiterRunCounters;
  diagnostics: RunDiagnostics;
  draftsCreated: number;
}): RunOutcome {
  const { counters, diagnostics, draftsCreated } = input;

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
    return {
      status: "partially_completed",
      errorMessage:
        "Geen concepten aangemaakt — geen bedrijven kwamen door contact- en scoredrempels.",
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
