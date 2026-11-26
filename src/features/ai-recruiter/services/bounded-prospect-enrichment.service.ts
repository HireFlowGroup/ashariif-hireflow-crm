import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type {
  BoundedEnrichmentBudget,
  BoundedEnrichmentResult,
  BoundedEnrichmentStepResult,
  ProspectSelectionEvidenceRecord,
} from "@/features/ai-recruiter/domain/prospect-selection-evidence.types";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import {
  assessMissingSelectionCriteria,
  buildProspectEvidenceBundle,
  employeeLabelIsVerified,
} from "@/features/ai-recruiter/services/prospect-selection-evidence.service";
import { parseEmployeeRangeFromLabel } from "@/features/ai-recruiter/services/employee-range-enrichment.service";

export type BoundedEnrichmentDeps = {
  /** Optional provider call (LLM/AI classifier). Tests supply mocks; no live calls by default. */
  resolveEmployeeRangeViaProvider?: (input: {
    company: Company;
    plan: AiRecruiterSearchPlan;
  }) => Promise<{
    label: string | null;
    verified: boolean;
    sourceUrl: string | null;
    sourceType: "llm_inference" | "provider_search";
  } | null>;
  readWebsiteText?: (url: string) => Promise<string | null>;
};

export function createEnrichmentBudget(): BoundedEnrichmentBudget {
  const config = getAiRecruiterConfig();
  return {
    maxSteps: config.prospectEnrichmentMaxSteps,
    maxProviderCalls: config.prospectEnrichmentMaxProviderCalls,
    stepsUsed: 0,
    providerCallsUsed: 0,
    budgetExhausted: false,
    stopReason: null,
  };
}

const FTE_SNIPPET = /(\d{1,5})\s*(?:tot|-|–)\s*(\d{1,5})\s*(?:medewerkers|employees|fte)/i;

function applyCompanyUpdates(company: Company, updates: BoundedEnrichmentResult["companyUpdates"]): Company {
  return {
    ...company,
    employeeCountMin: updates.employeeCountMin ?? company.employeeCountMin,
    employeeCountMax: updates.employeeCountMax ?? company.employeeCountMax,
    employeeCountLabel: updates.employeeCountLabel ?? company.employeeCountLabel,
    sector: updates.sector ?? company.sector,
    city: updates.city ?? company.city,
    region: updates.region ?? company.region,
  };
}

function step(
  budget: BoundedEnrichmentBudget,
  name: string,
  input: {
    run: () => BoundedEnrichmentStepResult | Promise<BoundedEnrichmentStepResult>;
    providerCall?: boolean;
  },
): Promise<BoundedEnrichmentStepResult> | BoundedEnrichmentStepResult {
  if (budget.budgetExhausted) {
    return {
      step: name,
      success: false,
      providerCall: false,
      message: budget.stopReason ?? "budget uitgeput",
      evidenceAdded: [],
    };
  }
  if (budget.stepsUsed >= budget.maxSteps) {
    budget.budgetExhausted = true;
    budget.stopReason = "maximale enrichment-stappen bereikt";
    return {
      step: name,
      success: false,
      providerCall: false,
      message: budget.stopReason,
      evidenceAdded: [],
    };
  }
  if (input.providerCall && budget.providerCallsUsed >= budget.maxProviderCalls) {
    budget.budgetExhausted = true;
    budget.stopReason = "provider-budget uitgeput";
    return {
      step: name,
      success: false,
      providerCall: true,
      message: budget.stopReason,
      evidenceAdded: [],
    };
  }

  budget.stepsUsed += 1;
  if (input.providerCall) budget.providerCallsUsed += 1;

  return input.run();
}

export async function runBoundedProspectEnrichment(input: {
  company: Company;
  plan: AiRecruiterSearchPlan;
  discoverySnippets?: string[];
  deps?: BoundedEnrichmentDeps;
  budget?: BoundedEnrichmentBudget;
}): Promise<{ company: Company; result: BoundedEnrichmentResult }> {
  const budget = input.budget ?? createEnrichmentBudget();
  const steps: BoundedEnrichmentStepResult[] = [];
  const extraEvidence: ProspectSelectionEvidenceRecord[] = [];
  const updates: BoundedEnrichmentResult["companyUpdates"] = {
    employeeCountMin: null,
    employeeCountMax: null,
    employeeCountLabel: null,
    sector: null,
    city: null,
    region: null,
  };

  let company = input.company;
  const missingBefore = assessMissingSelectionCriteria(company, input.plan);

  // Step: parse verified label on record
  const labelStep = step(budget, "parse_employee_label", {
    run: () => {
      if (!missingBefore.includes("employee_range")) {
        return { step: "parse_employee_label", success: true, providerCall: false, message: "niet vereist", evidenceAdded: [] };
      }
      const parsed = parseEmployeeRangeFromLabel(company.employeeCountLabel);
      if (parsed && employeeLabelIsVerified(company.employeeCountLabel)) {
        updates.employeeCountMin = parsed.min;
        updates.employeeCountMax = parsed.max ?? parsed.min;
        updates.employeeCountLabel = company.employeeCountLabel;
        const evidence: ProspectSelectionEvidenceRecord = {
          criterion: "employee_range",
          sourceUrl: company.website ?? company.sourceUrl,
          sourceType: "company_record",
          finding: company.employeeCountLabel ?? "",
          confidence: "verified",
          verifiedAt: new Date().toISOString(),
          conflictingFinding: null,
        };
        extraEvidence.push(evidence);
        company = applyCompanyUpdates(company, updates);
        return { step: "parse_employee_label", success: true, providerCall: false, message: "label geparsed", evidenceAdded: [evidence] };
      }
      return { step: "parse_employee_label", success: false, providerCall: false, message: "geen verifieerbaar label", evidenceAdded: [] };
    },
  });
  steps.push(await Promise.resolve(labelStep));

  // Step: discovery snippets (already paid for in discovery)
  const snippetStep = step(budget, "scan_discovery_snippets", {
    run: () => {
      const missing = assessMissingSelectionCriteria(company, input.plan);
      if (!missing.includes("employee_range") || !input.discoverySnippets?.length) {
        return { step: "scan_discovery_snippets", success: false, providerCall: false, message: "geen snippets", evidenceAdded: [] };
      }
      for (const snippet of input.discoverySnippets) {
        const match = snippet.match(FTE_SNIPPET);
        if (!match) continue;
        const min = Number.parseInt(match[1] ?? "", 10);
        const max = Number.parseInt(match[2] ?? "", 10);
        if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
        const finding = `${min}-${max} medewerkers (snippet)`;
        const evidence: ProspectSelectionEvidenceRecord = {
          criterion: "employee_range",
          sourceUrl: company.sourceUrl,
          sourceType: "discovery_snippet",
          finding,
          confidence: "inferred",
          verifiedAt: new Date().toISOString(),
          conflictingFinding: null,
        };
        updates.employeeCountMin = min;
        updates.employeeCountMax = max;
        updates.employeeCountLabel = finding;
        extraEvidence.push(evidence);
        company = applyCompanyUpdates(company, updates);
        return { step: "scan_discovery_snippets", success: true, providerCall: false, message: finding, evidenceAdded: [evidence] };
      }
      return { step: "scan_discovery_snippets", success: false, providerCall: false, message: "geen FTE in snippets", evidenceAdded: [] };
    },
  });
  steps.push(await Promise.resolve(snippetStep));

  // Step: optional website text (no provider id unless reader supplied)
  if (input.deps?.readWebsiteText && company.website) {
    const webStep = await step(budget, "read_company_website", {
      providerCall: false,
      run: async () => {
        const text = await input.deps!.readWebsiteText!(company.website!);
        if (!text) {
          return { step: "read_company_website", success: false, providerCall: false, message: "geen website-tekst", evidenceAdded: [] };
        }
        const added: ProspectSelectionEvidenceRecord[] = [];
        const match = text.match(FTE_SNIPPET);
        if (match && assessMissingSelectionCriteria(company, input.plan).includes("employee_range")) {
          const min = Number.parseInt(match[1] ?? "", 10);
          const max = Number.parseInt(match[2] ?? "", 10);
          const finding = `${min}-${max} medewerkers (website)`;
          updates.employeeCountMin = min;
          updates.employeeCountMax = max;
          updates.employeeCountLabel = `Bewijs in bron: ${finding}`;
          const evidence: ProspectSelectionEvidenceRecord = {
            criterion: "employee_range",
            sourceUrl: company.website,
            sourceType: "company_website",
            finding,
            confidence: "inferred",
            verifiedAt: new Date().toISOString(),
            conflictingFinding: null,
          };
          added.push(evidence);
          extraEvidence.push(evidence);
          company = applyCompanyUpdates(company, updates);
        }
        return {
          step: "read_company_website",
          success: added.length > 0,
          providerCall: false,
          message: added.length > 0 ? "website FTE gevonden" : "geen FTE op website",
          evidenceAdded: added,
        };
      },
    });
    steps.push(webStep);
  }

  // Step: optional provider (counts against provider budget)
  if (input.deps?.resolveEmployeeRangeViaProvider) {
    const providerStep = await step(budget, "provider_employee_range", {
      providerCall: true,
      run: async () => {
        if (!assessMissingSelectionCriteria(company, input.plan).includes("employee_range")) {
          return { step: "provider_employee_range", success: true, providerCall: true, message: "niet nodig", evidenceAdded: [] };
        }
        let resolved;
        try {
          resolved = await input.deps!.resolveEmployeeRangeViaProvider!({ company, plan: input.plan });
        } catch (error) {
          return {
            step: "provider_employee_range",
            success: false,
            providerCall: true,
            message: error instanceof Error ? error.message : "provider timeout",
            evidenceAdded: [],
          };
        }
        if (!resolved?.label) {
          return { step: "provider_employee_range", success: false, providerCall: true, message: "provider geen resultaat", evidenceAdded: [] };
        }
        const parsed = parseEmployeeRangeFromLabel(resolved.label);
        const confidence = resolved.verified ? "verified" : "inferred";
        if (!resolved.verified) {
          return {
            step: "provider_employee_range",
            success: false,
            providerCall: true,
            message: "alleen AI-inference — niet als verified opgeslagen",
            evidenceAdded: [
              {
                criterion: "employee_range",
                sourceUrl: resolved.sourceUrl,
                sourceType: resolved.sourceType,
                finding: resolved.label,
                confidence: "inferred",
                verifiedAt: new Date().toISOString(),
                conflictingFinding: "geen verifieerbare bron",
              },
            ],
          };
        }
        if (parsed) {
          updates.employeeCountMin = parsed.min;
          updates.employeeCountMax = parsed.max ?? parsed.min;
          updates.employeeCountLabel = `Bewijs in bron: ${resolved.label}`;
          company = applyCompanyUpdates(company, updates);
        }
        const evidence: ProspectSelectionEvidenceRecord = {
          criterion: "employee_range",
          sourceUrl: resolved.sourceUrl,
          sourceType: resolved.sourceType,
          finding: resolved.label,
          confidence,
          verifiedAt: new Date().toISOString(),
          conflictingFinding: null,
        };
        extraEvidence.push(evidence);
        return { step: "provider_employee_range", success: Boolean(parsed), providerCall: true, message: "provider verrijkt", evidenceAdded: [evidence] };
      },
    });
    steps.push(providerStep);
  }

  const evidence = buildProspectEvidenceBundle({ company, plan: input.plan, extraRecords: extraEvidence });
  const stillMissing = assessMissingSelectionCriteria(company, input.plan);

  const enrichmentSucceeded = stillMissing.length < missingBefore.length;
  let enrichmentIncompleteReason: string | null = null;
  if (stillMissing.length > 0) {
    enrichmentIncompleteReason = budget.budgetExhausted
      ? budget.stopReason
      : `Nog ontbrekend: ${stillMissing.join(", ")}`;
  }

  return {
    company,
    result: {
      companyUpdates: updates,
      evidence,
      steps,
      budget,
      enrichmentSucceeded,
      enrichmentIncompleteReason,
    },
  };
}