import {
  computePriority,
  priorityInputFromCandidate,
  priorityProfileToBreakdown,
  type PriorityProfile,
} from "@/features/priority-engine";
import type {
  LeadScoreComponents,
  LeadScoreInput,
  LeadScoreResult,
  WeightedComponentScore,
} from "@/features/lead-scoring/domain/lead-score.types";

function mapProfileToLeadScoreResult(profile: PriorityProfile): LeadScoreResult {
  const weightedComponents: WeightedComponentScore[] = profile.details.map((detail) => ({
    key: detail.key as WeightedComponentScore["key"],
    label: detail.label,
    rawScore: detail.score,
    weight: detail.weight,
    weightedScore: detail.weightedContribution,
  }));

  return {
    score: profile.compositeScore,
    priority: profile.priority,
    components: profile.components as LeadScoreComponents,
    weightedComponents,
    scoreReason: profile.summary,
    explanation: null,
    modelVersion: profile.modelVersion,
    scoredAt: profile.computedAt,
    priorityProfile: profile,
  };
}

/** @deprecated Use PriorityInput from @/features/priority-engine */
export type { LeadScoreInput };

/** Deterministic lead scoring via Priority Engine — no GPT. */
export function computeLeadScore(input: LeadScoreInput): LeadScoreResult {
  const profile = computePriority(input);
  return mapProfileToLeadScoreResult(profile);
}

export function leadScoreInputFromCandidate(
  candidate: import("@/features/lead-intelligence/domain").ExternalCompanyCandidate,
  criteria?: LeadScoreInput["criteria"],
  extras?: Partial<
    Pick<LeadScoreInput, "contactCount" | "hiringIntensity" | "signalCount" | "outreachStatus" | "contacts">
  >,
): LeadScoreInput {
  return priorityInputFromCandidate(candidate, criteria, extras);
}

export { priorityProfileToBreakdown };
