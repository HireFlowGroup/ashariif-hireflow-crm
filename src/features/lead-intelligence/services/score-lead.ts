import type {
  CompanySearchCriteria,
  ExternalCompanyCandidate,
  LeadPriority,
  LeadScoreResult,
  ScoreBreakdown,
} from "@/features/lead-intelligence/domain";
import {
  computeLeadScore,
  leadScoreInputFromCandidate,
} from "@/features/lead-scoring/services/lead-scoring-engine.service";
import { getLeadScoringConfig } from "@/features/lead-scoring/config/lead-scoring.config";
import { priorityFromScore as priorityFromScoreV2 } from "@/features/lead-scoring/domain/lead-score.types";

/** @deprecated Use computeLeadScore from @/features/lead-scoring */
export function scoreLead(
  candidate: ExternalCompanyCandidate,
  criteria: CompanySearchCriteria,
): LeadScoreResult {
  const result = computeLeadScore(
    leadScoreInputFromCandidate(candidate, {
      sector: criteria.sector,
      city: criteria.city,
      region: criteria.region,
      keywords: criteria.keywords,
      employeeCountMin: criteria.employeeCountMin,
      employeeCountMax: criteria.employeeCountMax,
    }),
  );

  return {
    score: result.score,
    priority: result.priority as LeadPriority,
    scoreReason: result.scoreReason,
    scoreBreakdown: result.components as unknown as ScoreBreakdown,
    scoredAt: result.scoredAt,
  };
}

export function priorityFromScore(score: number): LeadPriority {
  const config = getLeadScoringConfig();
  return priorityFromScoreV2(score, config.priorityThresholds);
}
