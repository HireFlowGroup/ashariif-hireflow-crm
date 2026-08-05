import type {
  RecruitmentIntelligenceAnalysis,
  RecruitmentOpportunityTier,
} from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { INSUFFICIENT_DATA } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";

export const OPPORTUNITY_TIER_WARM_MIN = 70;
export const OPPORTUNITY_TIER_INTERESSANT_MIN = 40;

export function computeOpportunityTier(
  score: number | null,
): RecruitmentOpportunityTier | null {
  if (score === null) return null;
  if (score >= OPPORTUNITY_TIER_WARM_MIN) return "warm";
  if (score >= OPPORTUNITY_TIER_INTERESSANT_MIN) return "interessant";
  return "lage_kans";
}

export function opportunityTierLabel(tier: RecruitmentOpportunityTier): string {
  switch (tier) {
    case "warm":
      return "Warm";
    case "interessant":
      return "Interessant";
    case "lage_kans":
      return "Lage kans";
  }
}

export function opportunityTierEmoji(tier: RecruitmentOpportunityTier): string {
  switch (tier) {
    case "warm":
      return "🟢";
    case "interessant":
      return "🟡";
    case "lage_kans":
      return "🔴";
  }
}

export function isInsufficientField(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  return value.trim() === INSUFFICIENT_DATA || value.trim() === "Onvoldoende data.";
}

export function analysisHasActionableFacts(analysis: RecruitmentIntelligenceAnalysis): boolean {
  return (
    !isInsufficientField(analysis.why_agency)
    && !isInsufficientField(analysis.likely_pain_points)
    && analysis.recruitment_opportunity_score !== null
  );
}

export function finalizeRecruitmentAnalysis(
  analysis: RecruitmentIntelligenceAnalysis,
): RecruitmentIntelligenceAnalysis {
  const recruitment_opportunity_score = analysis.recruitment_opportunity_score;
  const opportunity_tier = computeOpportunityTier(recruitment_opportunity_score);

  return {
    ...analysis,
    opportunity_tier,
  };
}

export function derivePriorityFromOpportunityScore(score: number | null): "A" | "B" | "C" | "Reject" {
  if (score === null) return "Reject";
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "Reject";
}
