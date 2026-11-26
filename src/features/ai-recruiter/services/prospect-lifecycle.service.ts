import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import { contactEmailMatchesCompanyDomain } from "@/features/ai-recruiter/services/contact-domain-validation.service";

export type ProspectLifecycle =
  | "rejected_prospect"
  | "needs_enrichment"
  | "qualified_prospect"
  | "draft_ready"
  | "outreach_ready";

const HARD_REJECT_REASONS = new Set([
  "no_matching_role",
  "wrong_location",
  "wrong_sector",
  "employee_range_mismatch",
  "duplicate_outreach",
  "commercial_hiring_below_plan",
  "invalid_contact",
  "suppressed_contact",
]);

function onlySoftEvidenceGaps(eligibility: ConceptEligibilityResult): boolean {
  const softExact = new Set(["no_contact", "employee_range_unknown", "contact_blocks_concept_score"]);
  return eligibility.rejectedRules.every(
    (rule) => rule.startsWith("needs_evidence:") || softExact.has(rule),
  );
}

/** CRM-mailbox uit opgeslagen bedrijfsrecord — geen verzonnen adressen. */
export function resolveCrmPublishedMailbox(company: Company): SelectedDiscoveredContact | null {
  const candidates = [
    { email: company.hrEmail, label: "HR" },
    { email: company.generalEmail, label: "Algemeen" },
    { email: company.email, label: "Contact" },
  ];

  for (const item of candidates) {
    const email = item.email?.trim();
    if (!email?.includes("@")) continue;
    if (!contactEmailMatchesCompanyDomain(email, company.domain ?? company.website)) continue;

    const local = email.split("@")[0]?.toLowerCase() ?? "";
    const isGeneral =
      /^(info|contact|hr|recruitment|recruiter|vacatures|werkenbij|careers|jobs|personeel)/.test(local);

    return {
      contactId: null,
      email,
      recipientName: null,
      jobTitle: `${item.label} (CRM-record)`,
      linkedinUrl: null,
      sourceType: "existing_crm",
      verificationStatus: "unknown",
      relevanceScore: isGeneral ? 55 : 65,
      confidence: 0.75,
      isGeneralMailbox: isGeneral || item.label !== "Contact",
      roleLabel: item.label,
      reliability: {
        level: "medium",
        score: 55,
        summary: "CRM-mailbox",
        factors: ["crm_published_mailbox"],
      },
      selectionReason: "crm_published_mailbox",
    };
  }

  return null;
}

export function isProspectDraftCapable(
  eligibility: ConceptEligibilityResult,
  plan: AiRecruiterSearchPlan,
): boolean {
  if (plan.outreach_mode !== "draft_only") return false;
  if (HARD_REJECT_REASONS.has(eligibility.reasonCode)) return false;
  if (eligibility.qualificationStatus === "eligible") return true;
  if (eligibility.qualificationStatus !== "needs_evidence") return false;
  if (!onlySoftEvidenceGaps(eligibility)) return false;

  const commercial = eligibility.contract?.commercial;
  if (!commercial) return false;

  const hiringOk = commercial.hiringPassed === true;
  const opportunityOk = commercial.opportunityPassed === true;
  const vacancyDenied = eligibility.rejectedRules.some((rule) =>
    ["no_active_vacancy", "no_matching_role"].includes(rule),
  );
  const vacancySignal =
    !vacancyDenied
    && (
      eligibility.acceptedRules.some((rule) =>
        /vacancy|relevant_focus|strict/.test(rule),
      )
      || eligibility.contract?.commercial?.hiringPassed === true
    );

  return hiringOk && vacancySignal && (opportunityOk || hiringOk);
}

export function deriveProspectLifecycle(input: {
  eligibility: ConceptEligibilityResult;
  plan: AiRecruiterSearchPlan;
  contact: SelectedDiscoveredContact | null;
}): ProspectLifecycle {
  const { eligibility, plan, contact } = input;

  if (eligibility.qualificationStatus === "rejected" || HARD_REJECT_REASONS.has(eligibility.reasonCode)) {
    return "rejected_prospect";
  }

  if (eligibility.qualificationStatus === "eligible" && contact?.email) {
    return eligibility.contract?.commercial?.passed ? "outreach_ready" : "draft_ready";
  }

  if (isProspectDraftCapable(eligibility, plan)) {
    return contact?.email ? "draft_ready" : "needs_enrichment";
  }

  if (eligibility.qualificationStatus === "needs_evidence") {
    return "needs_enrichment";
  }

  if (eligibility.contract?.commercial?.hiringPassed && eligibility.acceptedRules.includes("active_vacancy_found")) {
    return "qualified_prospect";
  }

  return "needs_enrichment";
}