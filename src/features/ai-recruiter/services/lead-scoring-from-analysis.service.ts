import type { Company } from "@/features/companies/domain";
import type {
  AiRecruiterScoreBreakdown,
  AiRecruiterSearchPlan,
} from "@/features/ai-recruiter/domain/types";
import { priorityFromTotalScore } from "@/features/ai-recruiter/domain/types";
import type { ContactScoreInput } from "@/features/ai-recruiter/services/lead-scoring.service";
import {
  analysisHasActionableFacts,
  derivePriorityFromOpportunityScore,
} from "@/features/recruitment-intelligence/domain/recruitment-opportunity.helpers";
import type { RecruitmentIntelligenceAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { INSUFFICIENT_DATA } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import type { LeadScoreResult } from "@/features/ai-recruiter/services/lead-scoring.service";

function computeContactScore(contact: ContactScoreInput): number {
  if (!contact.hasContact) return 0;

  let score = 40;
  if (contact.contactEmail) score += 20;
  if (contact.contactName) score += 10;

  switch (contact.verificationStatus) {
    case "verified":
      score += 25;
      break;
    case "likely":
      score += 15;
      break;
    case "catch_all":
      score += 5;
      break;
    default:
      break;
  }

  if (contact.confidence != null) {
    score += Math.round(contact.confidence * 15);
  }

  return Math.min(100, score);
}

export function computeLeadScoreFromAnalysis(
  company: Company,
  analysis: RecruitmentIntelligenceAnalysis | null,
  contact: ContactScoreInput,
  plan: AiRecruiterSearchPlan,
): LeadScoreResult {
  const explanations: string[] = [];

  if (!analysis || !analysisHasActionableFacts(analysis)) {
    return {
      companyFitScore: 0,
      hiringScore: 0,
      opportunityScore: 0,
      contactScore: 0,
      personalizationScore: 0,
      outreachReadinessScore: 0,
      totalScore: 0,
      priority: "Reject",
      breakdown: {
        companyFit: 0,
        hiring: 0,
        opportunity: 0,
        contact: 0,
        personalization: 0,
        outreachReadiness: 0,
        explanations: [`Geblokkeerd: ${INSUFFICIENT_DATA}`],
      },
    };
  }

  const opportunityScore = analysis.recruitment_opportunity_score ?? 0;
  const urgencyScore = analysis.urgency_score ?? 0;
  const contactScore = computeContactScore(contact);

  if (opportunityScore < plan.minimum_opportunity_score) {
    explanations.push(
      `Recruitment Opportunity Score ${opportunityScore} onder drempel ${plan.minimum_opportunity_score}.`,
    );
    return {
      companyFitScore: 0,
      hiringScore: urgencyScore,
      opportunityScore,
      contactScore,
      personalizationScore: 0,
      outreachReadinessScore: 0,
      totalScore: opportunityScore,
      priority: "Reject",
      breakdown: {
        companyFit: 0,
        hiring: urgencyScore,
        opportunity: opportunityScore,
        contact: contactScore,
        personalization: 0,
        outreachReadiness: 0,
        explanations,
        recruitmentIntelligenceTier: analysis.opportunity_tier ?? undefined,
        recruitmentIntelligenceScore: opportunityScore,
      },
    };
  }

  let companyFitScore = 0;
  if (company.sector) {
    companyFitScore += 20;
    explanations.push(`Sector: ${company.sector}`);
  }
  if (company.city) {
    companyFitScore += 10;
  }

  const personalizationScore =
    analysis.opening_line !== INSUFFICIENT_DATA && analysis.why_agency !== INSUFFICIENT_DATA ? 70 : 30;

  const outreachReadinessScore =
    contactScore >= 60 && analysis.recommended_cta !== INSUFFICIENT_DATA ? 80 : contactScore >= 40 ? 50 : 20;

  const totalScore = Math.round(
    opportunityScore * 0.55
    + contactScore * 0.2
    + urgencyScore * 0.1
    + companyFitScore * 0.05
    + personalizationScore * 0.05
    + outreachReadinessScore * 0.05,
  );

  const priority = derivePriorityFromOpportunityScore(opportunityScore);

  explanations.push(
    `Recruitment Intelligence: ${opportunityScore}/100 (${analysis.opportunity_tier ?? "onbekend"}).`,
    `Urgentie: ${urgencyScore}/100.`,
    `Beslisser: ${analysis.likely_decision_maker}.`,
  );

  const breakdown: AiRecruiterScoreBreakdown = {
    companyFit: companyFitScore,
    hiring: urgencyScore,
    opportunity: opportunityScore,
    contact: contactScore,
    personalization: personalizationScore,
    outreachReadiness: outreachReadinessScore,
    explanations,
    bestApproach: analysis.why_hireflow !== INSUFFICIENT_DATA ? analysis.why_hireflow : undefined,
    urgencyRationale:
      analysis.urgency_rationale !== INSUFFICIENT_DATA ? analysis.urgency_rationale : undefined,
    recruitmentIntelligenceTier: analysis.opportunity_tier ?? undefined,
    recruitmentIntelligenceScore: opportunityScore,
  };

  return {
    companyFitScore,
    hiringScore: urgencyScore,
    opportunityScore,
    contactScore,
    personalizationScore,
    outreachReadinessScore,
    totalScore,
    priority: priorityFromTotalScore(totalScore) === "Reject" ? priority : priorityFromTotalScore(totalScore),
    breakdown,
  };
}
