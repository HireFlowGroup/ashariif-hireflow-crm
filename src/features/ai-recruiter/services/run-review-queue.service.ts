import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";

type ExternalPayload = {
  eligibility?: {
    eligible?: boolean;
    qualificationStatus?: string;
    reasonCode?: string;
    userMessage?: string;
  };
};

export function externalEligibility(item: AiRecruiterRunItem): ExternalPayload["eligibility"] | null {
  const ext = item.externalCompanyData as ExternalPayload | null;
  return ext?.eligibility ?? null;
}

/** All persisted run items are traceable in run results (including skipped / rejected). */
export function isTraceableRunResultItem(_item: AiRecruiterRunItem): boolean {
  return true;
}

/** Outreach-actionable queue — excludes competitors, unresolved identity, and explicit ignore. */
export function isActionableOutreachReviewItem(item: AiRecruiterRunItem): boolean {
  const stageOk =
    item.stage === "draft_created"
    || item.outreachMessageId
    || item.stage === "contact_found"
    || item.stage === "general_mailbox_found"
    || item.stage === "blocked_missing_contact";
  if (!stageOk) return false;
  if (item.scoreBreakdown?.decision === "IGNORE") return false;
  if (item.scoreBreakdown?.identityUnresolved) return false;
  if (
    item.scoreBreakdown?.businessClassification === "recruitment_competitor"
    || item.scoreBreakdown?.businessClassification === "staffing_competitor"
  ) {
    return false;
  }
  const eligibility = externalEligibility(item);
  if (eligibility?.qualificationStatus === "rejected" && !item.outreachMessageId) {
    return false;
  }
  return true;
}

export function qualificationDisplayLabel(item: AiRecruiterRunItem): string {
  const eligibility = externalEligibility(item);
  const status = eligibility?.qualificationStatus;
  if (status === "rejected") return "Afgewezen";
  if (status === "needs_evidence") return "Evidence nodig";
  if (status === "qualified") return "Gekwalificeerd";
  if (eligibility?.eligible) return "Outreach eligible";
  if (item.stage === "draft_created" || item.outreachMessageId) return "Concept klaar";
  if (item.status === "skipped" || item.status === "failed") {
    return eligibility?.userMessage ?? item.rejectionReason ?? "Geblokkeerd";
  }
  if (item.stage === "contact_found" || item.stage === "general_mailbox_found") return "Contact gevonden";
  return "Ontdekt";
}