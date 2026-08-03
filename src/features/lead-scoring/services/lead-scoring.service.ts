import {
  computeLeadScore,
  leadScoreInputFromCandidate,
} from "@/features/lead-scoring/services/lead-scoring-engine.service";
import { generateScoreExplanation } from "@/features/lead-scoring/services/score-explanation.service";
import type { LeadScoreResult } from "@/features/lead-scoring/domain/lead-score.types";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";

export type ScoreLeadWithExplanationResult = LeadScoreResult & {
  aiSummary: string | null;
};

export async function scoreLeadWithExplanation(
  candidate: ExternalCompanyCandidate,
  criteria: CompanySearchCriteria,
): Promise<ScoreLeadWithExplanationResult> {
  const deterministic = computeLeadScore(
    leadScoreInputFromCandidate(candidate, {
      sector: criteria.sector,
      city: criteria.city,
      region: criteria.region,
      keywords: criteria.keywords,
      employeeCountMin: criteria.employeeCountMin,
      employeeCountMax: criteria.employeeCountMax,
    }),
  );

  const explanation = await generateScoreExplanation(deterministic, candidate);

  return {
    ...deterministic,
    scoreReason: deterministic.scoreReason,
    explanation,
    aiSummary: explanation,
  };
}

export { computeLeadScore, leadScoreInputFromCandidate };
