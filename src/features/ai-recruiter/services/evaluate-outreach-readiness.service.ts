import type {
  OutreachReadinessEvidence,
  OutreachReadinessProspect,
  OutreachReadinessResult,
} from "@/features/ai-recruiter/domain/outreach-readiness.types";
import { isProspectDraftCapable } from "@/features/ai-recruiter/services/prospect-lifecycle.service";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import {
  filterStrictVacancyEvidence,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";

function inferRecipientType(email: string | null, isGeneralMailbox: boolean): string {
  if (!email) return "unknown";
  const local = email.split("@")[0]?.toLowerCase() ?? "";

  if (!isGeneralMailbox) return "personal";

  if (/^(recruitment|recruiter|recruit|werving)/.test(local)) {
    return "recruitment_mailbox";
  }
  if (/^(careers|jobs|vacatures|werkenbij|job)/.test(local)) {
    return "careers_mailbox";
  }
  if (/^(hr|personeel|people|talent)/.test(local)) {
    return "hr_mailbox";
  }
  if (local === "info" || local === "contact") {
    return "general_mailbox";
  }
  return "general_mailbox";
}

function buildEvidence(prospect: OutreachReadinessProspect): OutreachReadinessEvidence[] {
  const evidence: OutreachReadinessEvidence[] = [];
  const strictVacancies = filterStrictVacancyEvidence(prospect.vacancies);

  for (const vacancy of strictVacancies.slice(0, 3)) {
    if (!strictVacancyEvidence(vacancy)) continue;
    evidence.push({
      type: "vacancy",
      claim: vacancy.jobTitle,
      sourceUrl: vacancy.jobUrl,
      sourceType: "vacancy",
      confidence: vacancy.isActive ? 0.95 : 0.7,
    });
  }

  return evidence;
}

export function evaluateConceptDraftReadiness(input: {
  prospect: OutreachReadinessProspect;
  eligibility: ConceptEligibilityResult;
  plan: AiRecruiterSearchPlan;
}): OutreachReadinessResult {
  const base = evaluateOutreachReadiness(input.prospect);
  const draftCapable = isProspectDraftCapable(input.eligibility, input.plan);
  const draftHardBlock = base.blockingReasons.filter(
    (reason) =>
      !["needs_evidence", "score_below_threshold", "no_contact", "employee_range_unknown"].includes(reason),
  );
  return {
    ...base,
    readyForConceptDraft:
      draftCapable
      && filterStrictVacancyEvidence(input.prospect.vacancies).length > 0
      && draftHardBlock.length === 0,
  };
}

export function evaluateOutreachReadiness(prospect: OutreachReadinessProspect): OutreachReadinessResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const evidence = buildEvidence(prospect);
  const strictVacancyCount = filterStrictVacancyEvidence(prospect.vacancies).length;
  const recipientType = inferRecipientType(prospect.contactEmail, prospect.isGeneralMailbox);

  if (prospect.isCompetitor) {
    blockingReasons.push("concurrent_uitgesloten");
  }
  if (prospect.isGenericIdentity) {
    blockingReasons.push("generieke_bedrijfsidentiteit");
  }
  if (!prospect.eligible) {
    blockingReasons.push(prospect.reasonCode);
  }
  if (prospect.score < prospect.threshold) {
    blockingReasons.push("score_below_threshold");
  }
  if (strictVacancyCount === 0) {
    blockingReasons.push("no_vacancy_evidence");
  }
  if (!prospect.contactEmail) {
    blockingReasons.push("no_contact");
  }
  if (prospect.invalidContact) {
    blockingReasons.push("invalid_contact");
  }
  if (prospect.suppressedContact) {
    blockingReasons.push("suppressed_contact");
  }
  if (prospect.bouncedContact) {
    blockingReasons.push("bounced_contact");
  }
  if (prospect.cooldownActive) {
    blockingReasons.push("cooldown_active");
  }
  if (prospect.duplicateOutreach) {
    blockingReasons.push("duplicate_outreach");
  }

  if (prospect.isGeneralMailbox) {
    warnings.push("algemene_mailbox");
  }
  if (prospect.contactVerificationStatus === "catch_all") {
    warnings.push("catch_all_mailbox");
  }
  if (evidence.length === 0) {
    warnings.push("insufficient_personalization_evidence");
  }

  const uniqueBlocking = [...new Set(blockingReasons)];

  return {
    ready: uniqueBlocking.length === 0,
    readyForConceptDraft: !uniqueBlocking.some((reason) =>
      ["no_vacancy_evidence", "concurrent_uitgesloten", "generieke_bedrijfsidentiteit", "duplicate_outreach", "cooldown_active"].includes(reason),
    ) && strictVacancyCount > 0,
    companyId: prospect.companyId,
    vacancyId: prospect.vacancyId ?? null,
    contactId: prospect.contactId,
    score: prospect.score,
    decision: prospect.decision,
    recipientType,
    blockingReasons: uniqueBlocking,
    warnings,
    evidence,
  };
}
