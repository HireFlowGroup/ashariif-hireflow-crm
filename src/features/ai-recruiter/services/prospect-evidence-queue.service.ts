import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { BoundedEnrichmentResult } from "@/features/ai-recruiter/domain/prospect-selection-evidence.types";
import type { VacancyHint } from "@/features/ai-recruiter/services/vacancy-verification-classifier.service";

export type ProspectEvidenceQueueEntry = {
  runItemId: string;
  companyId: string | null;
  companyName: string;
  qualificationStatus: "needs_evidence";
  missingInformation: string[];
  availableEvidence: string[];
  consultedSources: string[];
  verificationReason: string;
  budgetOrProviderLimits: string[];
  conceptBlocked: true;
  vacancyHints?: VacancyHint[];
};

function readEligibility(data: Record<string, unknown>): ConceptEligibilityResult | null {
  const pipeline = data.pipelineDecision;
  const pipelineEligibility =
    pipeline && typeof pipeline === "object" && "eligibility" in pipeline
      ? (pipeline as { eligibility?: unknown }).eligibility
      : null;
  const raw = data.eligibility ?? pipelineEligibility;
  if (!raw || typeof raw !== "object") return null;
  return raw as ConceptEligibilityResult;
}

function readEnrichment(data: Record<string, unknown>): BoundedEnrichmentResult | null {
  const prospect = data.prospectEvidence;
  const nested =
    prospect && typeof prospect === "object" && "boundedEnrichment" in prospect
      ? (prospect as { boundedEnrichment?: unknown }).boundedEnrichment
      : null;
  const raw = data.boundedEnrichment ?? nested;
  if (!raw || typeof raw !== "object") return null;
  return raw as BoundedEnrichmentResult;
}

export function buildProspectEvidenceQueue(items: AiRecruiterRunItem[]): ProspectEvidenceQueueEntry[] {
  const queue: ProspectEvidenceQueueEntry[] = [];

  for (const item of items) {
      const data = item.externalCompanyData ?? {};
      const eligibility = readEligibility(data);
      const status = eligibility?.qualificationStatus ?? null;
      if (status !== "needs_evidence") continue;

      const enrichment = readEnrichment(data);
      const evidenceBundle = (data.prospectEvidence as { missingCriteria?: string[]; evidence?: Array<{ criterion: string; finding: string }> } | undefined);

      const missing =
        evidenceBundle?.missingCriteria
        ?? enrichment?.evidence.missingCriteria
        ?? eligibility?.rejectedRules?.filter((rule) => rule.includes("unknown"))
        ?? [];

      const availableEvidence = (evidenceBundle?.evidence ?? []).map(
        (entry) => `${entry.criterion}: ${entry.finding}`,
      );

      const consultedSources = (enrichment?.steps ?? [])
        .map((step) => `${step.step}${step.success ? "" : " (mislukt)"}: ${step.message}`)
        .filter(Boolean);

      const budgetLimits: string[] = [];
      if (enrichment?.budget.budgetExhausted) {
        budgetLimits.push(enrichment.budget.stopReason ?? "Enrichment-budget uitgeput");
      }
      if (
        enrichment
        && enrichment.budget.providerCallsUsed >= enrichment.budget.maxProviderCalls
      ) {
        budgetLimits.push("Provider-call limiet bereikt");
      }

      const vacancyValidation = data.vacancyValidation as { hints?: VacancyHint[] } | undefined;

      queue.push({
        runItemId: item.id,
        companyId: item.companyId,
        companyName:
          item.companyName
          ?? (data.candidate as { name?: string } | undefined)?.name
          ?? "Onbekend bedrijf",
        qualificationStatus: "needs_evidence",
        missingInformation: missing.length ? missing : ["Onbekende selectiecriteria"],
        availableEvidence,
        consultedSources,
        verificationReason: eligibility?.userMessage ?? item.rejectionReason ?? "Aanvullend bewijs vereist",
        budgetOrProviderLimits: budgetLimits,
        conceptBlocked: true,
        vacancyHints: vacancyValidation?.hints,
      });
  }

  return queue;
}

export function isCommerciallyPresentableProspect(eligibility: ConceptEligibilityResult | null | undefined): boolean {
  return eligibility?.qualificationStatus === "eligible";
}