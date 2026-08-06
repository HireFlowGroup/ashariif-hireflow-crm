import "server-only";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function logConceptGenerationStart(input: {
  runId: string;
  runItemId: string;
  companyId: string;
  companyName: string;
  eligibilityStatus: string;
  opportunityScore: number;
  vacancyId?: string | null;
  vacancyTitle?: string | null;
  contactId?: string | null;
  recipientEmail: string;
  recipientType: string;
  evidenceCount: number;
}): void {
  console.info("[CONCEPT_GENERATION_START]", {
    run_id: input.runId,
    run_item_id: input.runItemId,
    company_id: input.companyId,
    company_name: input.companyName,
    eligibility_status: input.eligibilityStatus,
    opportunity_score: input.opportunityScore,
    vacancy_id: input.vacancyId ?? null,
    vacancy_title: input.vacancyTitle ?? null,
    contact_id: input.contactId ?? null,
    recipient_email: maskEmail(input.recipientEmail),
    recipient_type: input.recipientType,
    evidence_count: input.evidenceCount,
    started_at: new Date().toISOString(),
  });
}

export function logConceptGenerationAiResult(input: {
  runItemId: string;
  provider: string;
  model: string;
  durationMs: number;
  responseReceived: boolean;
  finishReason?: string | null;
  rawResponseLength: number;
  parsedSuccessfully: boolean;
  schemaValid: boolean;
  validationErrors: string[];
}): void {
  console.info("[CONCEPT_GENERATION_AI_RESULT]", {
    run_item_id: input.runItemId,
    provider: input.provider,
    model: input.model,
    duration_ms: input.durationMs,
    response_received: input.responseReceived,
    finish_reason: input.finishReason ?? null,
    raw_response_length: input.rawResponseLength,
    parsed_successfully: input.parsedSuccessfully,
    schema_valid: input.schemaValid,
    validation_errors: input.validationErrors,
  });
}

export function logConceptGenerationPersistence(input: {
  runItemId: string;
  draftId: string | null;
  inserted: boolean;
  linkedToRunItem: boolean;
  reviewStatus: string | null;
  persistenceError: string | null;
}): void {
  console.info("[CONCEPT_GENERATION_PERSISTENCE]", {
    run_item_id: input.runItemId,
    draft_id: input.draftId,
    inserted: input.inserted,
    linked_to_run_item: input.linkedToRunItem,
    review_status: input.reviewStatus,
    persistence_error: input.persistenceError,
  });
}
