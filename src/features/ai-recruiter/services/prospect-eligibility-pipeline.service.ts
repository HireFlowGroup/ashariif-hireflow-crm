import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import {
  buildVacancyEvidenceFromCompany,
  dedupeVacancyEvidence,
  desiredRoleMatchesVacancy,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import type { RecruitmentIntelligenceAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";

export type ProspectPipelineContext = {
  company: Company;
  plan: AiRecruiterSearchPlan;
  hiring: HiringIntelligenceProfile;
  analysis: RecruitmentIntelligenceAnalysis | null;
  contact: SelectedDiscoveredContact | null;
  contactStage: string;
  contactRejectionReason?: string | null;
  duplicateOutreach?: boolean;
  manualEligibilityOverride?: boolean;
};

export type ProspectPipelineDecision = {
  eligibility: ConceptEligibilityResult;
  vacancies: VacancyEvidence[];
  desiredRoleMatch: boolean;
  aiOpportunityScore: number | null;
};

export function evaluateProspectPipeline(context: ProspectPipelineContext): ProspectPipelineDecision {
  const vacancies = dedupeVacancyEvidence(buildVacancyEvidenceFromCompany(context.company, context.plan));
  const primaryTitle = vacancies[0]?.title ?? null;
  const desiredRoleMatch = primaryTitle
    ? desiredRoleMatchesVacancy(primaryTitle, context.plan)
    : context.plan.desired_roles.some((role) =>
        context.hiring.signals.some((signal) =>
          (signal.description ?? "").toLowerCase().includes(role.toLowerCase()),
        ),
      );

  const eligibility = evaluateConceptEligibility({
    company: context.company,
    plan: context.plan,
    hiringScore: context.hiring.hiringScore,
    vacancyCount: context.hiring.vacancyCount,
    vacancies,
    contact: context.contact,
    contactStage: context.contactStage,
    contactRejectionReason: context.contactRejectionReason,
    desiredRoleMatch,
    duplicateOutreach: context.duplicateOutreach,
    manualEligibilityOverride: context.manualEligibilityOverride,
  });

  return {
    eligibility,
    vacancies,
    desiredRoleMatch,
    aiOpportunityScore: context.analysis?.recruitment_opportunity_score ?? null,
  };
}

export type EligibilityRunSummary = {
  prospectsReviewed: number;
  eligibleCount: number;
  rejectedCount: number;
  averageScore: number;
  threshold: number;
  topRejectionReasons: Array<{ reason: string; count: number }>;
};

export function summarizeEligibilityDecisions(
  decisions: ConceptEligibilityResult[],
  threshold: number,
): EligibilityRunSummary {
  const eligible = decisions.filter((d) => d.eligible);
  const rejected = decisions.filter((d) => !d.eligible);
  const averageScore =
    decisions.length > 0
      ? Math.round(decisions.reduce((sum, d) => sum + d.score, 0) / decisions.length)
      : 0;

  const reasonCounts = new Map<string, number>();
  for (const decision of rejected) {
    const key = decision.reasonCode;
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }

  const topRejectionReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    prospectsReviewed: decisions.length,
    eligibleCount: eligible.length,
    rejectedCount: rejected.length,
    averageScore,
    threshold,
    topRejectionReasons,
  };
}
