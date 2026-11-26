import { describe, expect, it } from "vitest";

import type { ConceptGenerationProspectResult } from "@/features/ai-recruiter/domain/concept-generation.types";
import {
  aggregateConceptGenerationResults,
  allEligibleConceptsSkippedForExistingOutreach,
  classifyConceptGenerationOutcome,
  isConceptExistingOutreachSkip,
} from "@/features/ai-recruiter/services/concept-generation-result.helpers";
import { resolveConceptGenerationRunStatus } from "@/features/ai-recruiter/services/concept-generation-banner.service";
import { resolveRunOutcome } from "@/features/ai-recruiter/services/run-outcome.service";
import { createEmptyRunDiagnostics } from "@/features/ai-recruiter/domain/run-diagnostics";

function makeResult(
  overrides: Partial<ConceptGenerationProspectResult>,
): ConceptGenerationProspectResult {
  return {
    itemId: "item-1",
    companyId: "co-1",
    companyName: "Acme",
    success: false,
    outreachMessageId: null,
    conceptStatus: "failed",
    errorCode: "concept_generation_failed",
    errorMessage: "failed",
    usedFallback: false,
    warnings: [],
    ...overrides,
  };
}

describe("concept generation result helpers", () => {
  it("classifies duplicate outreach as skipped_existing_concept", () => {
    const result = makeResult({
      conceptStatus: "skipped",
      errorCode: "duplicate_outreach",
    });

    expect(isConceptExistingOutreachSkip(result)).toBe(true);
    expect(classifyConceptGenerationOutcome(result)).toBe("skipped_existing_concept");
  });

  it("aggregates created, skipped and failed counters separately", () => {
    const aggregated = aggregateConceptGenerationResults([
      makeResult({ success: true, conceptStatus: "created", errorCode: null }),
      makeResult({ conceptStatus: "skipped", errorCode: "duplicate_outreach" }),
      makeResult({ conceptStatus: "failed", errorCode: "concept_generation_failed" }),
    ]);

    expect(aggregated).toEqual({
      conceptsCreated: 1,
      conceptsSkipped: 1,
      conceptsFailed: 1,
    });
  });

  it("detects all-eligible skipped runs", () => {
    expect(
      allEligibleConceptsSkippedForExistingOutreach({
        prospectsEligible: 3,
        conceptsCreated: 0,
        conceptsFailed: 0,
        conceptsSkipped: 3,
      }),
    ).toBe(true);
  });
});

describe("run outcome for skipped existing concepts", () => {
  it("returns partially_completed when all eligible prospects were skipped", () => {
    const outcome = resolveRunOutcome({
      counters: {
        found: 4,
        validated: 4,
        withVacancies: 0,
        withSignals: 0,
        contactFound: 2,
        generalMailboxFound: 2,
        blockedMissingContact: 0,
        draftsCreated: 0,
        approved: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        replies: 0,
      },
      diagnostics: createEmptyRunDiagnostics(),
      draftsCreated: 0,
      conceptCounters: {
        prospectsEvaluated: 4,
        prospectsEligible: 3,
        conceptsStarted: 3,
        conceptsCreated: 0,
        conceptsFailed: 0,
        conceptsSkipped: 3,
        conceptsPending: 0,
        conceptsGenerating: 0,
      },
    });

    expect(outcome.status).toBe("partially_completed");
    expect(outcome.errorMessage).toContain("overgeslagen");
  });

  it("returns failed only for real generation failures", () => {
    const outcome = resolveRunOutcome({
      counters: {
        found: 4,
        validated: 4,
        withVacancies: 0,
        withSignals: 0,
        contactFound: 2,
        generalMailboxFound: 2,
        blockedMissingContact: 0,
        draftsCreated: 0,
        approved: 0,
        sent: 0,
        failed: 1,
        skipped: 0,
        replies: 0,
      },
      diagnostics: createEmptyRunDiagnostics(),
      draftsCreated: 0,
      conceptCounters: {
        prospectsEvaluated: 3,
        prospectsEligible: 3,
        conceptsStarted: 3,
        conceptsCreated: 0,
        conceptsFailed: 1,
        conceptsSkipped: 0,
        conceptsPending: 0,
        conceptsGenerating: 0,
      },
    });

    expect(outcome.status).toBe("failed");
  });

  it("resolves concept run status to partially_completed for all skips", () => {
    const status = resolveConceptGenerationRunStatus({
      draftsCreated: 0,
      conceptCounters: {
        prospectsEvaluated: 3,
        prospectsEligible: 3,
        conceptsStarted: 3,
        conceptsCreated: 0,
        conceptsFailed: 0,
        conceptsSkipped: 3,
        conceptsPending: 0,
        conceptsGenerating: 0,
      },
    });

    expect(status).toBe("partially_completed");
  });
});
