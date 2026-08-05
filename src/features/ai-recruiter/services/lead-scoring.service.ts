import type { Company } from "@/features/companies/domain";
import type {
  AiRecruiterScoreBreakdown,
  AiRecruiterSearchPlan,
} from "@/features/ai-recruiter/domain/types";
import { priorityFromTotalScore } from "@/features/ai-recruiter/domain/types";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import type { SalesIntelligenceAssessment } from "@/features/ai-recruiter/services/sales-intelligence.service";

export type ContactScoreInput = {
  hasContact: boolean;
  contactName: string | null;
  contactEmail: string | null;
  verificationStatus: "verified" | "likely" | "catch_all" | "invalid" | "unknown";
  confidence: number | null;
};

export type LeadScoreResult = {
  companyFitScore: number;
  hiringScore: number;
  opportunityScore: number;
  contactScore: number;
  personalizationScore: number;
  outreachReadinessScore: number;
  totalScore: number;
  priority: "A" | "B" | "C" | "Reject";
  breakdown: AiRecruiterScoreBreakdown;
};

export function computeLeadScore(
  company: Company,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
  sales: SalesIntelligenceAssessment,
  contact: ContactScoreInput,
  plan: AiRecruiterSearchPlan,
): LeadScoreResult {
  const salesFields = {
    salesScore: sales.salesScore,
    salesTier: sales.tier,
    salesWhy: sales.why,
    salesBreakdown: sales.breakdown,
  };

  const explanations: string[] = [
    ...hiring.explanations,
    `Sales Intelligence: ${sales.salesScore}/100 → ${sales.tier}.`,
    ...sales.why,
    `Opportunity score: ${opportunity.opportunityScore}/100 (${opportunity.agencyNeedLikelihood}).`,
    ...opportunity.why,
  ];

  if (sales.tier === "IGNORE") {
    return {
      companyFitScore: 0,
      hiringScore: hiring.hiringScore,
      opportunityScore: opportunity.opportunityScore,
      contactScore: 0,
      personalizationScore: 0,
      outreachReadinessScore: 0,
      totalScore: sales.salesScore,
      priority: "Reject",
      breakdown: {
        companyFit: 0,
        hiring: hiring.hiringScore,
        opportunity: opportunity.opportunityScore,
        contact: 0,
        personalization: 0,
        outreachReadiness: 0,
        explanations: [...explanations, "Geblokkeerd: Sales Intelligence tier IGNORE (<50)."],
        opportunityWhy: opportunity.why,
        rolesSought: opportunity.rolesSought,
        urgency: opportunity.urgency,
        bestApproach: opportunity.bestApproach,
        recruitmentPotential: opportunity.recruitmentPotential,
        recruitmentPotentialMotivation: opportunity.recruitmentPotentialMotivation,
        ...salesFields,
      },
    };
  }

  if (opportunity.opportunityScore < plan.minimum_opportunity_score) {
    return {
      companyFitScore: 0,
      hiringScore: hiring.hiringScore,
      opportunityScore: opportunity.opportunityScore,
      contactScore: 0,
      personalizationScore: 0,
      outreachReadinessScore: 0,
      totalScore: opportunity.opportunityScore,
      priority: "Reject",
      breakdown: {
        companyFit: 0,
        hiring: hiring.hiringScore,
        opportunity: opportunity.opportunityScore,
        contact: 0,
        personalization: 0,
        outreachReadiness: 0,
        explanations: [
          ...explanations,
          `Geblokkeerd voor outreach: Opportunity score onder ${plan.minimum_opportunity_score}.`,
        ],
        opportunityWhy: opportunity.why,
        rolesSought: opportunity.rolesSought,
        urgency: opportunity.urgency,
        bestApproach: opportunity.bestApproach,
        recruitmentPotential: opportunity.recruitmentPotential,
        recruitmentPotentialMotivation: opportunity.recruitmentPotentialMotivation,
        ...salesFields,
      },
    };
  }

  let companyFitScore = 0;
  if (company.sector) {
    companyFitScore += 20;
    explanations.push(`Sector: ${company.sector}`);
  }
  if (company.city && (plan.locations.length === 0 || plan.locations.some((l) => company.city!.toLowerCase().includes(l.toLowerCase())))) {
    companyFitScore += 20;
    explanations.push(`Locatie: ${company.city}`);
  }
  if (company.leadPriority === "A" || company.leadPriority === "B") {
    companyFitScore += 20;
    explanations.push(`Bestaande leadprioriteit: ${company.leadPriority}`);
  }
  companyFitScore = Math.min(40, companyFitScore);

  const hiringScore = hiring.hiringScore;
  const opportunityScore = opportunity.opportunityScore;

  let contactScore = 0;
  if (contact.hasContact) {
    if (contact.verificationStatus === "verified") contactScore = 30;
    else if (contact.verificationStatus === "likely") contactScore = 22;
    else if (contact.verificationStatus === "catch_all") contactScore = 15;
    else contactScore = 5;
    explanations.push(`Contact: ${contact.contactName ?? contact.contactEmail ?? "algemeen"} (${contact.verificationStatus})`);
  } else {
    explanations.push("Geen geschikt contact gevonden.");
  }

  let personalizationScore = 0;
  if (opportunity.rolesSought.length > 0) personalizationScore += 15;
  if (hiring.signals.length > 0) personalizationScore += 10;
  if (contact.contactName) personalizationScore += 5;
  personalizationScore = Math.min(30, personalizationScore);

  let outreachReadinessScore = 0;
  if (contact.hasContact && contact.verificationStatus !== "invalid") outreachReadinessScore += 20;
  if (!company.outreachOptOut) outreachReadinessScore += 10;
  if (opportunity.urgency === "high") outreachReadinessScore += 10;

  const totalScore = Math.min(
    100,
    Math.round(
      opportunityScore * 0.4 +
        contactScore * 0.25 +
        companyFitScore * 0.15 +
        hiringScore * 0.1 +
        personalizationScore * 0.05 +
        outreachReadinessScore * 0.05,
    ),
  );

  let priority = priorityFromTotalScore(totalScore);
  if (hiring.hiringScore < plan.minimum_hiring_score) {
    priority = "Reject";
    explanations.push(`Hiring score ${hiring.hiringScore} onder minimum ${plan.minimum_hiring_score}.`);
  }

  return {
    companyFitScore,
    hiringScore,
    opportunityScore,
    contactScore,
    personalizationScore,
    outreachReadinessScore,
    totalScore,
    priority,
    breakdown: {
      companyFit: companyFitScore,
      hiring: hiringScore,
      opportunity: opportunityScore,
      contact: contactScore,
      personalization: personalizationScore,
      outreachReadiness: outreachReadinessScore,
      explanations,
      opportunityWhy: opportunity.why,
      rolesSought: opportunity.rolesSought,
      urgency: opportunity.urgency,
      bestApproach: opportunity.bestApproach,
      recruitmentPotential: opportunity.recruitmentPotential,
      recruitmentPotentialMotivation: opportunity.recruitmentPotentialMotivation,
      ...salesFields,
    },
  };
}
