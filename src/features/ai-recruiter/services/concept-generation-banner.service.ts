import type { ConceptGenerationCounters } from "@/features/ai-recruiter/domain/concept-generation.types";
import type { AiRecruiterRunStatus } from "@/features/ai-recruiter/domain/types";

export function buildConceptGenerationRunMessage(input: {
  runStatus: AiRecruiterRunStatus;
  streaming: boolean;
  conceptCounters: ConceptGenerationCounters;
}): string | null {
  const { runStatus, streaming, conceptCounters } = input;

  if (streaming || runStatus === "drafting") {
    if (conceptCounters.conceptsGenerating > 0 || conceptCounters.conceptsStarted > conceptCounters.conceptsCreated) {
      const total = Math.max(conceptCounters.prospectsEligible, conceptCounters.conceptsStarted);
      return `${total} concepten worden voorbereid…`;
    }
    if (conceptCounters.prospectsEligible > 0 && conceptCounters.conceptsStarted === 0) {
      return "Conceptgeneratie kon niet worden gestart.";
    }
  }

  if (conceptCounters.conceptsGenerating > 0) {
    return `${conceptCounters.conceptsGenerating} concepten worden voorbereid…`;
  }

  if (conceptCounters.conceptsPending > 0 && conceptCounters.conceptsCreated === 0) {
    return null;
  }

  if (conceptCounters.conceptsCreated > 0 && conceptCounters.conceptsFailed > 0) {
    return `Conceptgeneratie afgerond: ${conceptCounters.conceptsCreated} aangemaakt, ${conceptCounters.conceptsFailed} mislukt.`;
  }

  if (
    conceptCounters.conceptsCreated === 0
    && conceptCounters.conceptsFailed === 0
    && conceptCounters.conceptsGenerating === 0
    && conceptCounters.conceptsPending === 0
    && conceptCounters.prospectsEligible > 0
    && ["partially_completed", "failed", "awaiting_approval", "completed"].includes(runStatus)
  ) {
    return "Geen concepten aangemaakt";
  }

  return null;
}

export function resolveConceptGenerationRunStatus(input: {
  conceptCounters: ConceptGenerationCounters;
  draftsCreated: number;
}): AiRecruiterRunStatus {
  const { conceptCounters, draftsCreated } = input;

  if (conceptCounters.conceptsGenerating > 0) {
    return "drafting";
  }

  if (draftsCreated > 0 && conceptCounters.conceptsFailed > 0) {
    return "partially_completed";
  }

  if (draftsCreated > 0) {
    return "awaiting_approval";
  }

  if (conceptCounters.prospectsEligible === 0) {
    return "completed";
  }

  if (conceptCounters.conceptsFailed > 0 && conceptCounters.conceptsCreated === 0) {
    return "failed";
  }

  return "partially_completed";
}
