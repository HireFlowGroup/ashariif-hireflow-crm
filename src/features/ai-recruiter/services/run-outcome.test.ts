import { describe, expect, it } from "vitest";

import { createInitialConceptCounters } from "@/features/ai-recruiter/domain/concept-generation.types";
import { createEmptyRunDiagnostics } from "@/features/ai-recruiter/domain/run-diagnostics";
import { createInitialCounters } from "@/features/ai-recruiter/domain/types";
import { resolveRunOutcome } from "@/features/ai-recruiter/services/run-outcome.service";

describe("resolveRunOutcome", () => {
  it("returns partially_completed when companies saved but no eligible concepts", () => {
    const diagnostics = {
      ...createEmptyRunDiagnostics(),
      errorCode: null,
      errorMessage: null,
      providerName: "serpapi",
      responseCount: 15,
      normalizedCount: 7,
      rejectedCount: 8,
      durationMs: 1000,
    };

    const outcome = resolveRunOutcome({
      counters: { ...createInitialCounters(), found: 15, validated: 7 },
      diagnostics,
      draftsCreated: 0,
      eligibilitySummary: {
        prospectsReviewed: 3,
        eligibleCount: 0,
        rejectedCount: 3,
        averageScore: 12,
        threshold: 30,
        qualificationPolicySummary: "conceptdrempel 30 · commercieel hiring ≥ 70 · commercieel opportunity ≥ 70",
        topRejectionReasons: [{ reason: "employee_range_unknown", count: 3 }],
      },
      conceptCounters: {
        ...createInitialConceptCounters(),
        prospectsEvaluated: 0,
        prospectsEligible: 0,
      },
    });

    expect(outcome.status).toBe("partially_completed");
    expect(outcome.errorMessage).toMatch(/Geen concepten aangemaakt/i);
  });

  it("keeps failed on provider discovery failure", () => {
    const outcome = resolveRunOutcome({
      counters: createInitialCounters(),
      diagnostics: {
        ...createEmptyRunDiagnostics(),
        errorCode: "provider_rate_limited",
        errorMessage: "Tavily quota",
        providerName: "tavily",
        responseCount: 0,
        normalizedCount: 0,
        rejectedCount: 0,
        durationMs: 100,
      },
      draftsCreated: 0,
    });

    expect(outcome.status).toBe("failed");
  });
});