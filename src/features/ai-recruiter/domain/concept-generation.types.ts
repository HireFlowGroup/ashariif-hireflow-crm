import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { Company } from "@/features/companies/domain";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";

export type ConceptGenerationStatus =
  | "pending"
  | "generating"
  | "generated"
  | "generated_with_fallback"
  | "created"
  | "failed"
  | "skipped"
  | "blocked";

export type ConceptGenerationCounters = {
  prospectsEvaluated: number;
  prospectsEligible: number;
  conceptsStarted: number;
  conceptsCreated: number;
  conceptsFailed: number;
  conceptsSkipped: number;
  conceptsPending: number;
  conceptsGenerating: number;
};

export function createInitialConceptCounters(): ConceptGenerationCounters {
  return {
    prospectsEvaluated: 0,
    prospectsEligible: 0,
    conceptsStarted: 0,
    conceptsCreated: 0,
    conceptsFailed: 0,
    conceptsSkipped: 0,
    conceptsPending: 0,
    conceptsGenerating: 0,
  };
}

export type EligibleProspectForConcept = {
  itemId: string;
  companyId: string;
  company: Company;
  selected: SelectedDiscoveredContact;
  vacancies: VacancyEvidence[];
  contactStage: string;
  opportunity: OpportunityAssessment;
  eligibility: ConceptEligibilityResult;
  vacancyId?: string | null;
};

export type ConceptGenerationProspectResult = {
  itemId: string;
  companyId: string;
  companyName: string;
  success: boolean;
  outreachMessageId: string | null;
  conceptStatus: ConceptGenerationStatus;
  errorCode: string | null;
  errorMessage: string | null;
  usedFallback: boolean;
  warnings: string[];
};

export type ConceptGenerationDispatchResult = {
  results: ConceptGenerationProspectResult[];
  counters: ConceptGenerationCounters;
};
