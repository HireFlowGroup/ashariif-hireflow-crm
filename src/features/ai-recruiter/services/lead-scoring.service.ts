import type { Company } from "@/features/companies/domain";
import type {
  AiRecruiterScoreBreakdown,
  AiRecruiterSearchPlan,
} from "@/features/ai-recruiter/domain/types";
import { priorityFromTotalScore } from "@/features/ai-recruiter/domain/types";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";

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
  contact: ContactScoreInput,
  plan: AiRecruiterSearchPlan,
): LeadScoreResult {
  const explanations: string[] = [...hiring.explanations];

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
  if (hiring.vacancyCount > 0) personalizationScore += 15;
  if (hiring.signals.length > 0) personalizationScore += 10;
  if (contact.contactName) personalizationScore += 5;
  personalizationScore = Math.min(30, personalizationScore);

  let outreachReadinessScore = 0;
  if (contact.hasContact && contact.verificationStatus !== "invalid") outreachReadinessScore += 20;
  if (!company.outreachOptOut) outreachReadinessScore += 10;
  if (hiringScore >= plan.minimum_hiring_score) outreachReadinessScore += 10;

  const totalScore = Math.min(
    100,
    Math.round(
      companyFitScore * 0.2 +
        hiringScore * 0.35 +
        contactScore * 0.25 +
        personalizationScore * 0.1 +
        outreachReadinessScore * 0.1,
    ),
  );

  return {
    companyFitScore,
    hiringScore,
    contactScore,
    personalizationScore,
    outreachReadinessScore,
    totalScore,
    priority: priorityFromTotalScore(totalScore),
    breakdown: {
      companyFit: companyFitScore,
      hiring: hiringScore,
      contact: contactScore,
      personalization: personalizationScore,
      outreachReadiness: outreachReadinessScore,
      explanations,
    },
  };
}
