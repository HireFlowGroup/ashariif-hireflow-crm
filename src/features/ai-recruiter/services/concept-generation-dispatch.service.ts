import "server-only";

import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type {
  ConceptGenerationCounters,
  ConceptGenerationDispatchResult,
  ConceptGenerationProspectResult,
  ConceptGenerationStatus,
  EligibleProspectForConcept,
} from "@/features/ai-recruiter/domain/concept-generation.types";
import { createInitialConceptCounters } from "@/features/ai-recruiter/domain/concept-generation.types";
import type { AiRecruiterEngineContext } from "@/features/ai-recruiter/domain/types";
import type { AiRecruiterRepository } from "@/features/ai-recruiter/repositories/ai-recruiter.repository";
import { ProspectAuditRepository } from "@/features/ai-recruiter/repositories/prospect-audit.repository";
import {
  logConceptGenerationAiResult,
  logConceptGenerationPersistence,
  logConceptGenerationStart,
} from "@/features/ai-recruiter/services/concept-generation-trace.service";
import { buildDeterministicOutreachFallback } from "@/features/ai-recruiter/services/deterministic-outreach-fallback.service";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { generateRecruitmentOutreachDraftWithValidation } from "@/features/ai-recruiter/services/recruitment-outreach-writer.service";
import { evaluateOutreachReadiness } from "@/features/ai-recruiter/services/evaluate-outreach-readiness.service";
import type { OutreachEngine } from "@/features/outreach-engine/services/outreach-engine.service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import { getOutreachSendConfig } from "@/features/outreach-engine/domain/send-rules.config";

const DEFAULT_CONCEPT_TIMEOUT_MS = 90_000;

function inferRecipientType(email: string, isGeneralMailbox: boolean): string {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (!isGeneralMailbox) return "personal";
  if (/^(recruitment|recruiter|recruit|werving)/.test(local)) return "recruitment_mailbox";
  if (/^(careers|jobs|vacatures|werkenbij|job)/.test(local)) return "careers_mailbox";
  if (/^(hr|personeel|people|talent)/.test(local)) return "hr_mailbox";
  return "general_mailbox";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: concept_generation_timeout`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function terminalConceptStatus(success: boolean, usedFallback: boolean): ConceptGenerationStatus {
  if (!success) return "failed";
  return usedFallback ? "generated_with_fallback" : "generated";
}

export function filterEligibleProspectsForConceptGeneration(
  prospects: EligibleProspectForConcept[],
): EligibleProspectForConcept[] {
  return prospects.filter((prospect) => {
    if (!prospect.eligibility.eligible) return false;
    if (!prospect.selected.email?.trim()) return false;
    return true;
  });
}

async function persistConceptForProspect(
  context: AiRecruiterEngineContext,
  outreachEngine: OutreachEngine,
  input: {
    runId: string;
    companyId: string;
    selected: EligibleProspectForConcept["selected"];
    subject: string;
    bodyText: string;
    personalizationData: Record<string, unknown>;
    vacancyId?: string | null;
  },
): Promise<{ messageId: string; reviewStatus: string }> {
  const message = await outreachEngine.createRecruiterDraft(context, {
    companyId: input.companyId,
    contactId: input.selected.contactId,
    recipientName: input.selected.recipientName,
    recipientEmail: input.selected.email,
    subject: input.subject,
    bodyText: input.bodyText,
    runId: input.runId,
    vacancyId: input.vacancyId ?? null,
    personalizationData: input.personalizationData,
  });

  return { messageId: message.id, reviewStatus: message.status };
}

async function processEligibleProspect(
  context: AiRecruiterEngineContext,
  runId: string,
  plan: AiRecruiterSearchPlan,
  prospect: EligibleProspectForConcept,
  outreachEngine: OutreachEngine,
  repository: AiRecruiterRepository,
  prospectAudit: ProspectAuditRepository,
  conceptTimeoutMs: number,
): Promise<ConceptGenerationProspectResult> {
  const { itemId, companyId, company, selected, vacancies, contactStage, opportunity, eligibility } = prospect;
  const hiring = computeHiringIntelligenceProfile(company, plan);
  const readiness = evaluateOutreachReadiness({
    companyId,
    companyName: company.name,
    isCompetitor: false,
    isGenericIdentity: false,
    score: eligibility.score,
    decision: eligibility.priority,
    threshold: eligibility.threshold,
    eligible: eligibility.eligible,
    contactEmail: selected.email,
    contactId: selected.contactId,
    isGeneralMailbox: selected.isGeneralMailbox,
    contactVerificationStatus: selected.verificationStatus,
    duplicateOutreach: false,
    cooldownActive: false,
    suppressedContact: false,
    bouncedContact: false,
    invalidContact: false,
    hasVacancyEvidence: vacancies.length > 0,
    vacancies,
    hiringSignalCount: hiring.signals.length,
    reasonCode: eligibility.reasonCode,
    userMessage: eligibility.userMessage,
    vacancyId: prospect.vacancyId ?? null,
  });

  logConceptGenerationStart({
    runId,
    runItemId: itemId,
    companyId,
    companyName: company.name,
    eligibilityStatus: eligibility.eligible ? "eligible" : "ineligible",
    opportunityScore: opportunity.opportunityScore,
    vacancyId: prospect.vacancyId ?? null,
    vacancyTitle: vacancies[0]?.title ?? null,
    contactId: selected.contactId,
    recipientEmail: selected.email,
    recipientType: readiness.recipientType,
    evidenceCount: readiness.evidence.length,
  });

  await prospectAudit.updateConceptStatus(context.organizationId, itemId, {
    conceptStatus: "generating",
  });

  let usedFallback = false;
  let warnings: string[] = [];
  let aiMeta = {
    provider: "openai",
    model: "unknown",
    durationMs: 0,
    parsedSuccessfully: false,
    schemaValid: false,
    validationErrors: [] as string[],
  };

  try {
    const generation = await withTimeout(
      generateRecruitmentOutreachDraftWithValidation({
        company,
        vacancy: vacancies[0]
          ? { id: prospect.vacancyId ?? "unknown", title: vacancies[0].title }
          : null,
        hiringSignals: hiring,
        companyAnalysis: opportunity,
        selectedContact: {
          email: selected.email,
          recipientName: selected.recipientName,
          isGeneralMailbox: selected.isGeneralMailbox,
          jobTitle: selected.jobTitle,
          reliability: selected.reliability,
        },
        opportunityScore: opportunity.opportunityScore,
        vacancies,
      }),
      conceptTimeoutMs,
      itemId,
    );

    aiMeta = generation.meta;
    logConceptGenerationAiResult({
      runItemId: itemId,
      provider: generation.meta.provider,
      model: generation.meta.model,
      durationMs: generation.meta.durationMs,
      responseReceived: generation.meta.responseReceived,
      finishReason: generation.meta.finishReason,
      rawResponseLength: generation.meta.rawResponseLength,
      parsedSuccessfully: generation.meta.parsedSuccessfully,
      schemaValid: generation.meta.schemaValid,
      validationErrors: generation.meta.validationErrors,
    });

    let draft = generation.draft;
    usedFallback = generation.usedFallback;
    warnings = [...draft.warnings];

    if (!generation.meta.schemaValid) {
      const fallback = buildDeterministicOutreachFallback({
        company,
        vacancies,
        recipientEmail: selected.email,
        recipientName: selected.recipientName,
        isGeneralMailbox: selected.isGeneralMailbox,
        senderName: getOutreachSendConfig().senderName ?? undefined,
      });
      draft = {
        ...draft,
        recommendedSubject: fallback.subject,
        subject: fallback.subject,
        salutation: fallback.salutation,
        bodyText: fallback.bodyText,
        body: fallback.bodyText,
        cta: fallback.cta,
        closing: fallback.closing,
        personalizationFacts: fallback.personalizationFacts,
        sourceEvidence: fallback.sourceEvidence,
        warnings: [...fallback.warnings, ...warnings],
        model: "deterministic_fallback",
        confidence: 0.45,
      };
      usedFallback = true;
    }

    const personalizationData = {
      companyName: company.name,
      sector: company.sector,
      city: company.city,
      contactName: selected.recipientName,
      vacancyCount: hiring.vacancyCount,
      hiringSignal: hiring.signals[0]?.description ?? null,
      fieldsUsed: draft.personalizationFacts.map((f) => f.claim),
      warnings: draft.warnings,
      generatedAt: new Date().toISOString(),
      personalizationFacts: draft.personalizationFacts,
      sourceEvidence: draft.sourceEvidence,
      promptVersion: draft.promptVersion,
      model: draft.model,
      intent: "permission_to_source_candidates",
      cta: draft.cta,
      salutation: draft.salutation,
      runId,
      vacancyId: prospect.vacancyId ?? null,
      usedFallback,
    };

    const { messageId, reviewStatus } = await persistConceptForProspect(context, outreachEngine, {
      runId,
      companyId,
      selected,
      subject: draft.recommendedSubject,
      bodyText: draft.bodyText,
      personalizationData,
      vacancyId: prospect.vacancyId ?? null,
    });

    const existingItem = await repository.getRunItem(context.organizationId, itemId);
    const external = (existingItem?.externalCompanyData ?? {}) as Record<string, unknown>;

    await repository.updateRunItem(context.organizationId, itemId, {
      stage: "draft_created",
      status: "completed",
      outreachMessageId: messageId,
      warnings: draft.warnings,
      externalCompanyData: {
        ...external,
        conceptGeneration: {
          status: terminalConceptStatus(true, usedFallback),
          usedFallback,
          model: draft.model,
        },
      },
    });

    const conceptStatus = terminalConceptStatus(true, usedFallback);
    await prospectAudit.updateConceptStatus(context.organizationId, itemId, {
      conceptStatus,
    });

    logConceptGenerationPersistence({
      runItemId: itemId,
      draftId: messageId,
      inserted: true,
      linkedToRunItem: true,
      reviewStatus,
      persistenceError: null,
    });

    return {
      itemId,
      companyId,
      companyName: company.name,
      success: true,
      outreachMessageId: messageId,
      conceptStatus,
      errorCode: null,
      errorMessage: null,
      usedFallback,
      warnings,
    };
  } catch (error) {
    if (error instanceof OutreachEngineError && error.code === "duplicate") {
      await prospectAudit.updateConceptStatus(context.organizationId, itemId, {
        conceptStatus: "skipped",
        finalReason: "Duplicate outreach — actief concept bestaat al.",
        reasonCode: "duplicate_outreach",
      });

      return {
        itemId,
        companyId,
        companyName: company.name,
        success: false,
        outreachMessageId: null,
        conceptStatus: "skipped",
        errorCode: "duplicate_outreach",
        errorMessage: error.message,
        usedFallback: false,
        warnings,
      };
    }

    const errorCode =
      error instanceof OutreachEngineError
        ? error.code
        : error instanceof Error && error.message.includes("concept_generation_timeout")
          ? "concept_generation_timeout"
          : error instanceof Error && error.message.includes("Bericht kon niet")
            ? "persistence_failed"
            : "concept_generation_failed";
    const errorMessage = error instanceof Error ? error.message : "Conceptgeneratie mislukt";

    logConceptGenerationAiResult({
      runItemId: itemId,
      provider: aiMeta.provider,
      model: aiMeta.model,
      durationMs: aiMeta.durationMs,
      responseReceived: aiMeta.parsedSuccessfully,
      finishReason: null,
      rawResponseLength: 0,
      parsedSuccessfully: aiMeta.parsedSuccessfully,
      schemaValid: aiMeta.schemaValid,
      validationErrors: aiMeta.validationErrors.length
        ? aiMeta.validationErrors
        : [errorMessage],
    });

    logConceptGenerationPersistence({
      runItemId: itemId,
      draftId: null,
      inserted: false,
      linkedToRunItem: false,
      reviewStatus: null,
      persistenceError: errorMessage,
    });

    await prospectAudit.updateConceptStatus(context.organizationId, itemId, {
      conceptStatus: "failed",
      finalReason: errorMessage,
      reasonCode: errorCode,
    });

    await repository.updateRunItem(context.organizationId, itemId, {
      status: "failed",
      rejectionReason: errorMessage,
      externalCompanyData: {
        conceptGeneration: {
          status: "failed",
          errorCode,
          errorMessage,
        },
      },
    });

    return {
      itemId,
      companyId,
      companyName: company.name,
      success: false,
      outreachMessageId: null,
      conceptStatus: "failed",
      errorCode,
      errorMessage,
      usedFallback: false,
      warnings,
    };
  }
}

export async function dispatchConceptGeneration(input: {
  context: AiRecruiterEngineContext;
  runId: string;
  plan: AiRecruiterSearchPlan;
  eligibleProspects: EligibleProspectForConcept[];
  outreachEngine: OutreachEngine;
  repository: AiRecruiterRepository;
  prospectAudit: ProspectAuditRepository;
  maxConcepts: number;
  conceptTimeoutMs?: number;
}): Promise<ConceptGenerationDispatchResult> {
  const eligibleProspects = filterEligibleProspectsForConceptGeneration(input.eligibleProspects);
  const limited = eligibleProspects.slice(0, Math.max(0, input.maxConcepts));
  const counters: ConceptGenerationCounters = {
    ...createInitialConceptCounters(),
    prospectsEvaluated: input.eligibleProspects.length,
    prospectsEligible: eligibleProspects.length,
    conceptsPending: Math.max(0, eligibleProspects.length - limited.length),
  };

  console.info("[ConceptGenerationDispatch] start", {
    run_id: input.runId,
    eligible_count: eligibleProspects.length,
    dispatch_count: limited.length,
    max_concepts: input.maxConcepts,
  });

  if (limited.length === 0) {
    return { results: [], counters };
  }

  counters.conceptsStarted = limited.length;
  counters.conceptsGenerating = limited.length;

  const timeoutMs = input.conceptTimeoutMs ?? DEFAULT_CONCEPT_TIMEOUT_MS;
  const settled = await Promise.allSettled(
    limited.map((prospect) =>
      processEligibleProspect(
        input.context,
        input.runId,
        input.plan,
        prospect,
        input.outreachEngine,
        input.repository,
        input.prospectAudit,
        timeoutMs,
      ),
    ),
  );

  const results: ConceptGenerationProspectResult[] = settled.map((entry, index) => {
    if (entry.status === "fulfilled") return entry.value;
    const prospect = limited[index]!;
    return {
      itemId: prospect.itemId,
      companyId: prospect.companyId,
      companyName: prospect.company.name,
      success: false,
      outreachMessageId: null,
      conceptStatus: "failed",
      errorCode: "dispatch_rejected",
      errorMessage: entry.reason instanceof Error ? entry.reason.message : "Dispatch mislukt",
      usedFallback: false,
      warnings: [],
    };
  });

  counters.conceptsGenerating = 0;
  counters.conceptsCreated = results.filter((r) => r.success).length;
  counters.conceptsFailed = results.filter((r) => !r.success).length;
  counters.conceptsPending = Math.max(
    0,
    eligibleProspects.length - counters.conceptsCreated - counters.conceptsFailed - counters.conceptsSkipped,
  );

  console.info("[ConceptGenerationDispatch] complete", {
    run_id: input.runId,
    concepts_created: counters.conceptsCreated,
    concepts_failed: counters.conceptsFailed,
  });

  return { results, counters };
}
