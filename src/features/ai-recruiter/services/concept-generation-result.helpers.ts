import type {
  ConceptGenerationCounters,
  ConceptGenerationProspectResult,
} from "@/features/ai-recruiter/domain/concept-generation.types";

export const CONCEPT_SKIP_REASON_CODES = new Set([
  "duplicate_outreach",
  "outreach_cooldown",
]);

export type ConceptGenerationOutcome =
  | "concept_generated"
  | "skipped_existing_concept"
  | "generation_failed";

export function isConceptExistingOutreachSkip(
  result: Pick<ConceptGenerationProspectResult, "conceptStatus" | "errorCode">,
): boolean {
  return (
    result.conceptStatus === "skipped"
    && result.errorCode !== null
    && CONCEPT_SKIP_REASON_CODES.has(result.errorCode)
  );
}

export function classifyConceptGenerationOutcome(
  result: ConceptGenerationProspectResult,
): ConceptGenerationOutcome {
  if (result.success) {
    return "concept_generated";
  }

  if (isConceptExistingOutreachSkip(result)) {
    return "skipped_existing_concept";
  }

  return "generation_failed";
}

export function aggregateConceptGenerationResults(
  results: ConceptGenerationProspectResult[],
): Pick<ConceptGenerationCounters, "conceptsCreated" | "conceptsFailed" | "conceptsSkipped"> {
  let conceptsCreated = 0;
  let conceptsFailed = 0;
  let conceptsSkipped = 0;

  for (const result of results) {
    switch (classifyConceptGenerationOutcome(result)) {
      case "concept_generated":
        conceptsCreated += 1;
        break;
      case "skipped_existing_concept":
        conceptsSkipped += 1;
        break;
      case "generation_failed":
        conceptsFailed += 1;
        break;
    }
  }

  return { conceptsCreated, conceptsFailed, conceptsSkipped };
}

export function allEligibleConceptsSkippedForExistingOutreach(
  conceptCounters: Pick<
    ConceptGenerationCounters,
    "prospectsEligible" | "conceptsCreated" | "conceptsFailed" | "conceptsSkipped"
  >,
): boolean {
  return (
    conceptCounters.prospectsEligible > 0
    && conceptCounters.conceptsCreated === 0
    && conceptCounters.conceptsFailed === 0
    && conceptCounters.conceptsSkipped > 0
    && conceptCounters.conceptsSkipped >= conceptCounters.prospectsEligible
  );
}
