import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { BoundedEnrichmentResult } from "@/features/ai-recruiter/domain/prospect-selection-evidence.types";
import {
  type BoundedEnrichmentDeps,
  runBoundedProspectEnrichment,
} from "@/features/ai-recruiter/services/bounded-prospect-enrichment.service";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import { buildProspectEvidenceBundle } from "@/features/ai-recruiter/services/prospect-selection-evidence.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import { safeReadWebsiteTextOrNull } from "@/features/company-finder/discovery/safe-website-fetch.service";

export type ProspectRequalificationInput = {
  company: Company;
  plan: AiRecruiterSearchPlan;
  hiringScore: number;
  opportunityScore: number;
  vacancyCount: number;
  vacancies: VacancyEvidence[];
  contact: SelectedDiscoveredContact | null;
  contactStage: string;
  contactRejectionReason?: string | null;
  desiredRoleMatch?: boolean;
  duplicateOutreach?: boolean;
  manualEligibilityOverride?: boolean;
  invalidContact?: boolean;
  discoverySnippets?: string[];
  enrichmentDeps?: BoundedEnrichmentDeps;
  /** When true, skip enrichment (e.g. vacancy stage already rejected). */
  skipEnrichment?: boolean;
};

export type ProspectRequalificationResult = {
  company: Company;
  enrichment: BoundedEnrichmentResult | null;
  eligibility: ConceptEligibilityResult;
  evidenceBundle: ReturnType<typeof buildProspectEvidenceBundle>;
};

export async function qualifyProspectWithBoundedEnrichment(
  input: ProspectRequalificationInput,
): Promise<ProspectRequalificationResult> {
  const initialBundle = buildProspectEvidenceBundle({ company: input.company, plan: input.plan });

  if (initialBundle.conflictingCriteria.length > 0) {
    const eligibility = evaluateConceptEligibility({
      company: input.company,
      plan: input.plan,
      hiringScore: input.hiringScore,
      opportunityScore: input.opportunityScore,
      vacancyCount: input.vacancyCount,
      vacancies: input.vacancies,
      contact: input.contact,
      contactStage: input.contactStage,
      contactRejectionReason: input.contactRejectionReason,
      desiredRoleMatch: input.desiredRoleMatch,
      duplicateOutreach: input.duplicateOutreach,
      manualEligibilityOverride: input.manualEligibilityOverride,
      invalidContact: input.invalidContact,
      evidenceBundle: initialBundle,
    });
    return {
      company: input.company,
      enrichment: null,
      eligibility,
      evidenceBundle: initialBundle,
    };
  }

  let company = input.company;
  let enrichment: BoundedEnrichmentResult | null = null;

  const needsEnrichment =
    !input.skipEnrichment
    && !input.manualEligibilityOverride
    && initialBundle.missingCriteria.length > 0;

  if (needsEnrichment) {
    const enrichmentDeps: BoundedEnrichmentDeps = {
      ...input.enrichmentDeps,
      readWebsiteText:
        input.enrichmentDeps?.readWebsiteText
        ?? ((url) => safeReadWebsiteTextOrNull(url)),
    };

    const enriched = await runBoundedProspectEnrichment({
      company: input.company,
      plan: input.plan,
      discoverySnippets: input.discoverySnippets,
      deps: enrichmentDeps,
    });
    company = enriched.company;
    enrichment = enriched.result;
  }

  const evidenceBundle = buildProspectEvidenceBundle({
    company,
    plan: input.plan,
    extraRecords: enrichment?.evidence.records.filter(
      (r) => !initialBundle.records.some((b) => b.finding === r.finding),
    ),
  });

  const eligibility = evaluateConceptEligibility({
    company,
    plan: input.plan,
    hiringScore: input.hiringScore,
    opportunityScore: input.opportunityScore,
    vacancyCount: input.vacancyCount,
    vacancies: input.vacancies,
    contact: input.contact,
    contactStage: input.contactStage,
    contactRejectionReason: input.contactRejectionReason,
    desiredRoleMatch: input.desiredRoleMatch,
    duplicateOutreach: input.duplicateOutreach,
    manualEligibilityOverride: input.manualEligibilityOverride,
    invalidContact: input.invalidContact,
    evidenceBundle,
    enrichmentDiagnostics: enrichment,
  });

  return { company, enrichment, eligibility, evidenceBundle };
}