import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type {
  ConceptEligibilityReasonCode,
  ConceptEligibilityResult,
  QualificationStatus,
  VacancyEvidence,
} from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { BoundedEnrichmentResult, ProspectEvidenceBundle } from "@/features/ai-recruiter/domain/prospect-selection-evidence.types";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import {
  computeDeterministicLeadScore,
  type DeterministicLeadScoreResult,
} from "@/features/ai-recruiter/services/deterministic-lead-score.service";
import {
  evaluateEmployeeRangeConstraint,
  evaluateLocationConstraint,
  evaluateSectorConstraint,
} from "@/features/ai-recruiter/services/company-constraint-validation.service";
import {
  applyCommercialRelevanceGate,
  enrichEligibilityWithContract,
} from "@/features/ai-recruiter/services/qualification-contract.service";
import {
  countStrictActiveVacancies,
  desiredRoleMatchesVacancy,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";

export type ConceptEligibilityInput = {
  company: Company;
  plan: AiRecruiterSearchPlan;
  /** Hiring-intelligence score (commercieel + input voor deterministische score). */
  hiringScore: number;
  /** Recruitment opportunity score (commerciele plan-drempel). */
  opportunityScore?: number | null;
  vacancyCount: number;
  vacancies: VacancyEvidence[];
  contact: SelectedDiscoveredContact | null;
  contactStage: string;
  contactRejectionReason?: string | null;
  desiredRoleMatch?: boolean;
  duplicateOutreach?: boolean;
  cooldownActive?: boolean;
  manualEligibilityOverride?: boolean;
  suppressedContact?: boolean;
  invalidContact?: boolean;
  evidenceBundle?: ProspectEvidenceBundle;
  enrichmentDiagnostics?: BoundedEnrichmentResult | null;
};

function statusFromReason(
  reasonCode: ConceptEligibilityReasonCode,
  explicit?: QualificationStatus,
): QualificationStatus {
  if (explicit) return explicit;
  if (reasonCode === "eligible" || reasonCode === "manual_override") return "eligible";
  if (reasonCode === "needs_evidence" || reasonCode === "employee_range_unknown") return "needs_evidence";
  return "rejected";
}

function attachStatus(
  partial: Omit<ConceptEligibilityResult, "qualificationStatus" | "eligible" | "contract">,
  qualificationStatus?: QualificationStatus,
): Omit<ConceptEligibilityResult, "contract"> {
  const status = qualificationStatus ?? statusFromReason(partial.reasonCode);
  return {
    ...partial,
    qualificationStatus: status,
    eligible: status === "eligible",
  };
}

function buildUserMessage(
  reasonCode: ConceptEligibilityReasonCode,
  score: number,
  threshold: number,
): string {
  switch (reasonCode) {
    case "eligible":
      return `Prospect is eligible voor conceptgeneratie (prospectscore ${score}, conceptdrempel ${threshold}).`;
    case "manual_override":
      return "Handmatige override — conceptgeneratie toegestaan.";
    case "no_active_vacancy":
      return "Geen actuele vacature gevonden.";
    case "no_matching_role":
      return "Wel vacatures gevonden, maar geen match met de gevraagde functies.";
    case "no_contact":
      return "Geen bruikbaar e-mailadres gevonden.";
    case "invalid_contact":
      return "Contactadres is ongeldig of niet bruikbaar.";
    case "suppressed_contact":
      return "Contactadres staat op suppressielijst of is gebouncet.";
    case "score_below_threshold":
      return `Prospectscore ${score} onder conceptdrempel ${threshold} (deterministische conceptgereedheid).`;
    case "wrong_location":
      return "Bedrijf valt buiten de gevraagde regio.";
    case "wrong_sector":
      return "Bedrijf past niet bij de gevraagde sector.";
    case "duplicate_outreach":
      return "Er bestaat al actieve outreach voor dit bedrijf/vacature.";
    case "cooldown_active":
      return "Cooldown actief — recent al benaderd.";
    case "missing_required_data":
      return "Onvoldoende gegevens om een concept te maken.";
    case "needs_evidence":
      return "Onvoldoende verifieerbaar bewijs — aanvullende evidence of enrichment vereist vóór conceptgeneratie.";
    case "employee_range_unknown":
      return "Medewerkersaantal onbekend — needs_evidence (geen automatische afwijzing).";
    case "employee_range_mismatch":
      return "Medewerkersaantal valt buiten de gevraagde range.";
    case "commercial_hiring_below_plan":
      return "Hiring score onder de commerciële plan-drempel.";
    case "commercial_opportunity_below_plan":
      return "Opportunity score onder de commerciële plan-drempel.";
    case "commercial_scores_missing":
      return "Commerciële scores ontbreken voor plan-drempelbeoordeling.";
    default:
      return "Prospect niet eligible voor conceptgeneratie.";
  }
}

function finalizeEligibility(
  input: ConceptEligibilityInput,
  partial: Omit<ConceptEligibilityResult, "contract" | "qualificationStatus" | "eligible">,
  qualificationStatus?: QualificationStatus,
): ConceptEligibilityResult {
  let result = attachStatus(partial, qualificationStatus);

  if (result.reasonCode === "eligible" && result.qualificationStatus === "eligible") {
    const config = getAiRecruiterConfig();
    const gate = applyCommercialRelevanceGate({
      plan: input.plan,
      hiringScore: input.hiringScore,
      opportunityScore: input.opportunityScore,
      leadScore: partial.score,
      conceptThreshold: config.conceptScoreThreshold,
      priority: partial.priority,
      acceptedRules: partial.acceptedRules,
      rejectedRules: partial.rejectedRules,
    });

    if (!gate.ok) {
      result = attachStatus(
        {
          ...partial,
          priority: "reject",
          rejectedRules: [...partial.rejectedRules, gate.reasonCode],
          reasonCode: gate.reasonCode,
          userMessage: gate.userMessage,
        },
        "rejected",
      );
    }
  }

  return enrichEligibilityWithContract(
    input,
    result,
    {
      evidenceBundle: input.evidenceBundle,
      enrichmentDiagnostics: input.enrichmentDiagnostics,
    },
  );
}

export function evaluateConceptEligibility(input: ConceptEligibilityInput): ConceptEligibilityResult {
  const config = getAiRecruiterConfig();
  const threshold = config.conceptScoreThreshold;
  const acceptedRules: string[] = [];
  const rejectedRules: string[] = [];

  if (input.manualEligibilityOverride) {
    return finalizeEligibility(input, {
      score: 100,
      threshold,
      priority: "priority_a",
      acceptedRules: ["manual_eligibility_override"],
      rejectedRules: [],
      reasonCode: "manual_override",
      userMessage: buildUserMessage("manual_override", 100, threshold),
    });
  }

  if (input.duplicateOutreach) {
    rejectedRules.push("duplicate_outreach");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "duplicate_outreach",
      userMessage: buildUserMessage("duplicate_outreach", 0, threshold),
    });
  }

  if (input.cooldownActive) {
    rejectedRules.push("cooldown_active");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "cooldown_active",
      userMessage: buildUserMessage("cooldown_active", 0, threshold),
    });
  }

  if (input.suppressedContact) {
    rejectedRules.push("suppressed_contact");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "suppressed_contact",
      userMessage: buildUserMessage("suppressed_contact", 0, threshold),
    });
  }

  if (input.invalidContact) {
    rejectedRules.push("invalid_contact");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "invalid_contact",
      userMessage: buildUserMessage("invalid_contact", 0, threshold),
    });
  }

  const strictVacancies = input.vacancies.filter(strictVacancyEvidence);
  const activeVacancyCount = countStrictActiveVacancies(input.vacancies);

  if (input.plan.vacancy_required && activeVacancyCount === 0) {
    rejectedRules.push("no_active_vacancy");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "no_active_vacancy",
      userMessage: buildUserMessage("no_active_vacancy", 0, threshold),
    });
  }

  const roleMatchedVacancies =
    input.plan.desired_roles.length === 0
      ? strictVacancies
      : strictVacancies.filter((vacancy) => desiredRoleMatchesVacancy(vacancy.title, input.plan));

  if (input.plan.vacancy_required && input.plan.desired_roles.length > 0 && roleMatchedVacancies.length === 0) {
    rejectedRules.push("no_matching_role");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "no_matching_role",
      userMessage: buildUserMessage("no_matching_role", 0, threshold),
    });
  }

  const desiredRoleMatch =
    input.desiredRoleMatch
    ?? (roleMatchedVacancies.length > 0
      || (input.plan.desired_roles.length === 0 && activeVacancyCount > 0));

  if (input.evidenceBundle?.conflictingCriteria.length) {
    const conflicts = input.evidenceBundle.conflictingCriteria.join(", ");
    rejectedRules.push("conflicting_evidence");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "missing_required_data",
      userMessage: `Tegenstrijdig bewijs voor: ${conflicts}.`,
    }, "rejected");
  }

  const employeeRequired =
    input.plan.employee_range.min !== null || input.plan.employee_range.max !== null;
  const employeeStatus = evaluateEmployeeRangeConstraint(input.company, input.plan);

  if (employeeStatus === "mismatched") {
    rejectedRules.push("employee_range_mismatch");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "employee_range_mismatch",
      userMessage: buildUserMessage("employee_range_mismatch", 0, threshold),
    });
  }

  const locationStatus = evaluateLocationConstraint(input.company, input.plan);
  const sectorStatus = evaluateSectorConstraint(input.company, input.plan);

  const softEvidenceGaps: string[] = [];
  if (employeeRequired && employeeStatus === "unknown") softEvidenceGaps.push("employee_range");
  if (input.plan.sectors.length > 0 && sectorStatus === "unknown") softEvidenceGaps.push("sector");
  if (
    (input.plan.locations.length > 0 || input.plan.regions.length > 0)
    && locationStatus === "unknown"
  ) {
    softEvidenceGaps.push("location");
  }

  if (softEvidenceGaps.length > 0) {
    rejectedRules.push(...softEvidenceGaps.map((gap) => `needs_evidence:${gap}`));
    acceptedRules.push("soft_evidence_gaps_deferred");
  }

  if (locationStatus === "mismatched") {
    rejectedRules.push("wrong_location");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "wrong_location",
      userMessage: buildUserMessage("wrong_location", 0, threshold),
    });
  }

  if (sectorStatus === "mismatched") {
    rejectedRules.push("wrong_sector");
    return finalizeEligibility(input, {
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "wrong_sector",
      userMessage: buildUserMessage("wrong_sector", 0, threshold),
    });
  }

  const leadScore: DeterministicLeadScoreResult = computeDeterministicLeadScore({
    company: input.company,
    plan: input.plan,
    vacancies: roleMatchedVacancies.length > 0 ? roleMatchedVacancies : strictVacancies,
    vacancyCount: activeVacancyCount,
    hiringScore: input.hiringScore,
    contact: input.contact,
    desiredRoleMatch,
  });

  acceptedRules.push(...leadScore.acceptedRules);
  rejectedRules.push(...leadScore.rejectedRules);

  if (softEvidenceGaps.length > 0) {
    const exhausted = input.enrichmentDiagnostics?.budget.budgetExhausted;
    const message = exhausted
      ? `Nog ontbrekend bewijs (${softEvidenceGaps.join(", ")}) — ${input.enrichmentDiagnostics?.enrichmentIncompleteReason ?? "enrichment-budget uitgeput"}.`
      : input.contact?.email
        ? `Prospect kwalificeert op vacature/contact; ontbrekend bewijs: ${softEvidenceGaps.join(", ")} — enrichment of review.`
        : `Prospect kwalificeert op vacature; ontbrekend: ${softEvidenceGaps.join(", ")} — enrichment of handmatige review.`;
    return finalizeEligibility(
      input,
      {
        score: leadScore.score,
        threshold,
        priority: leadScore.priority,
        acceptedRules,
        rejectedRules,
        reasonCode: "needs_evidence",
        userMessage: message,
      },
      "needs_evidence",
    );
  }

  if (leadScore.score < threshold) {
    const commercialHiringOk = input.hiringScore >= input.plan.minimum_hiring_score;
    const commercialOpportunityOk =
      input.opportunityScore != null && input.opportunityScore >= input.plan.minimum_opportunity_score;
    if (
      !input.contact?.email
      && (activeVacancyCount > 0 || strictVacancies.length > 0 || input.vacancyCount > 0)
      && commercialHiringOk
      && commercialOpportunityOk
    ) {
      if (input.contactRejectionReason) {
        rejectedRules.push(input.contactRejectionReason);
      }
      rejectedRules.push("needs_evidence:contact");
      return finalizeEligibility(
        input,
        {
          score: leadScore.score,
          threshold,
          priority: leadScore.priority,
          acceptedRules: [...acceptedRules, "prospect_core_qualified", "contact_blocks_concept_score"],
          rejectedRules,
          reasonCode: "needs_evidence",
          userMessage:
            "Commercieel en vacature-signaal voldoende; contact ontbreekt — prospect blijft bewaard (niet outreach-eligible).",
        },
        "needs_evidence",
      );
    }
    rejectedRules.push("score_below_threshold");
    return finalizeEligibility(input, {
      score: leadScore.score,
      threshold,
      priority: leadScore.priority,
      acceptedRules,
      rejectedRules,
      reasonCode: "score_below_threshold",
      userMessage: buildUserMessage("score_below_threshold", leadScore.score, threshold),
    });
  }

  if (!input.contact?.email) {
    if (input.contactRejectionReason) {
      rejectedRules.push(input.contactRejectionReason);
    }
    rejectedRules.push("needs_evidence:contact");
    return finalizeEligibility(
      input,
      {
        score: leadScore.score,
        threshold,
        priority: leadScore.priority,
        acceptedRules: [...acceptedRules, "prospect_core_qualified"],
        rejectedRules,
        reasonCode: "needs_evidence",
        userMessage:
          "Werkgever scoort op vacature/rolpad, maar contact is nog niet geverifieerd — opgeslagen voor evidence queue (niet outreach-eligible).",
      },
      "needs_evidence",
    );
  }

  acceptedRules.push("eligible_for_concept");
  if (input.contact.isGeneralMailbox) {
    acceptedRules.push("general_mailbox_available");
  }

  return finalizeEligibility(input, {
    score: leadScore.score,
    threshold,
    priority: leadScore.priority,
    acceptedRules,
    rejectedRules,
    reasonCode: "eligible",
    userMessage: buildUserMessage("eligible", leadScore.score, threshold),
  });
}