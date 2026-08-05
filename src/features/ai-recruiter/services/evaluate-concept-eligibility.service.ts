import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type {
  ConceptEligibilityReasonCode,
  ConceptEligibilityResult,
  VacancyEvidence,
} from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import {
  computeDeterministicLeadScore,
  type DeterministicLeadScoreResult,
} from "@/features/ai-recruiter/services/deterministic-lead-score.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";

export type ConceptEligibilityInput = {
  company: Company;
  plan: AiRecruiterSearchPlan;
  hiringScore: number;
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
};

function buildUserMessage(
  reasonCode: ConceptEligibilityReasonCode,
  score: number,
  threshold: number,
): string {
  switch (reasonCode) {
    case "eligible":
      return `Prospect is eligible voor conceptgeneratie (score ${score}, drempel ${threshold}).`;
    case "manual_override":
      return "Handmatige override — conceptgeneratie toegestaan.";
    case "no_active_vacancy":
      return "Geen actuele of aannemelijke vacature gevonden.";
    case "no_contact":
      return "Geen bruikbaar e-mailadres gevonden.";
    case "invalid_contact":
      return "Contactadres is ongeldig of niet bruikbaar.";
    case "suppressed_contact":
      return "Contactadres staat op suppressielijst of is gebouncet.";
    case "score_below_threshold":
      return `Score ${score} onder drempel ${threshold}.`;
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
    default:
      return "Prospect niet eligible voor conceptgeneratie.";
  }
}

export function evaluateConceptEligibility(input: ConceptEligibilityInput): ConceptEligibilityResult {
  const config = getAiRecruiterConfig();
  const threshold = config.conceptScoreThreshold;
  const acceptedRules: string[] = [];
  const rejectedRules: string[] = [];

  if (input.manualEligibilityOverride) {
    return {
      eligible: true,
      score: 100,
      threshold,
      priority: "priority_a",
      acceptedRules: ["manual_eligibility_override"],
      rejectedRules: [],
      reasonCode: "manual_override",
      userMessage: buildUserMessage("manual_override", 100, threshold),
    };
  }

  if (input.duplicateOutreach) {
    rejectedRules.push("duplicate_outreach");
    return {
      eligible: false,
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "duplicate_outreach",
      userMessage: buildUserMessage("duplicate_outreach", 0, threshold),
    };
  }

  if (input.cooldownActive) {
    rejectedRules.push("cooldown_active");
    return {
      eligible: false,
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "cooldown_active",
      userMessage: buildUserMessage("cooldown_active", 0, threshold),
    };
  }

  if (input.suppressedContact) {
    rejectedRules.push("suppressed_contact");
    return {
      eligible: false,
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "suppressed_contact",
      userMessage: buildUserMessage("suppressed_contact", 0, threshold),
    };
  }

  if (input.invalidContact) {
    rejectedRules.push("invalid_contact");
    return {
      eligible: false,
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "invalid_contact",
      userMessage: buildUserMessage("invalid_contact", 0, threshold),
    };
  }

  if (!input.contact?.email) {
    if (input.contactRejectionReason) {
      rejectedRules.push(input.contactRejectionReason);
    }
    rejectedRules.push("no_contact");
    return {
      eligible: false,
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "no_contact",
      userMessage: buildUserMessage("no_contact", 0, threshold),
    };
  }

  const activeVacancy =
    input.vacancyCount > 0
    || input.vacancies.some((v) => v.isActive)
    || input.vacancies.length > 0;

  if (input.plan.vacancy_required && !activeVacancy) {
    rejectedRules.push("no_active_vacancy");
    return {
      eligible: false,
      score: 0,
      threshold,
      priority: "reject",
      acceptedRules,
      rejectedRules,
      reasonCode: "no_active_vacancy",
      userMessage: buildUserMessage("no_active_vacancy", 0, threshold),
    };
  }

  const leadScore: DeterministicLeadScoreResult = computeDeterministicLeadScore({
    company: input.company,
    plan: input.plan,
    vacancies: input.vacancies,
    vacancyCount: input.vacancyCount,
    hiringScore: input.hiringScore,
    contact: input.contact,
    desiredRoleMatch: input.desiredRoleMatch ?? false,
  });

  acceptedRules.push(...leadScore.acceptedRules);
  rejectedRules.push(...leadScore.rejectedRules);

  if (leadScore.score < threshold) {
    rejectedRules.push("score_below_threshold");
    return {
      eligible: false,
      score: leadScore.score,
      threshold,
      priority: leadScore.priority,
      acceptedRules,
      rejectedRules,
      reasonCode: "score_below_threshold",
      userMessage: buildUserMessage("score_below_threshold", leadScore.score, threshold),
    };
  }

  acceptedRules.push("eligible_for_concept");
  if (input.contact.isGeneralMailbox) {
    acceptedRules.push("general_mailbox_available");
  }

  return {
    eligible: true,
    score: leadScore.score,
    threshold,
    priority: leadScore.priority,
    acceptedRules,
    rejectedRules,
    reasonCode: "eligible",
    userMessage: buildUserMessage("eligible", leadScore.score, threshold),
  };
}
