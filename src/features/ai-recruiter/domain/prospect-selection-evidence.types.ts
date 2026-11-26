/** P0-R2 — traceable evidence for plan selection criteria (aligned with qualification contract). */

export const PROSPECT_EVIDENCE_MODEL_VERSION = "p0-r2-v1";

export type SelectionCriterionKey =
  | "employee_range"
  | "sector"
  | "location"
  | "vacancy_role"
  | "contact"
  | "commercial_hiring"
  | "commercial_opportunity";

export type EvidenceConfidence = "verified" | "inferred" | "unknown" | "conflicting";

export type EvidenceSourceType =
  | "company_record"
  | "discovery_snippet"
  | "company_website"
  | "about_page"
  | "careers_page"
  | "vacancy_page"
  | "crm_record"
  | "provider_search"
  | "llm_inference";

export type ProspectSelectionEvidenceRecord = {
  criterion: SelectionCriterionKey;
  sourceUrl: string | null;
  sourceType: EvidenceSourceType;
  /** Factual claim extracted from the source (no invention). */
  finding: string;
  confidence: EvidenceConfidence;
  verifiedAt: string;
  /** When another record contradicts this finding for the same criterion. */
  conflictingFinding: string | null;
};

export type ProspectEvidenceBundle = {
  version: typeof PROSPECT_EVIDENCE_MODEL_VERSION;
  records: ProspectSelectionEvidenceRecord[];
  missingCriteria: SelectionCriterionKey[];
  conflictingCriteria: SelectionCriterionKey[];
};

export type BoundedEnrichmentBudget = {
  maxSteps: number;
  maxProviderCalls: number;
  stepsUsed: number;
  providerCallsUsed: number;
  budgetExhausted: boolean;
  stopReason: string | null;
};

export type BoundedEnrichmentStepResult = {
  step: string;
  success: boolean;
  providerCall: boolean;
  message: string;
  evidenceAdded: ProspectSelectionEvidenceRecord[];
};

export type BoundedEnrichmentResult = {
  companyUpdates: {
    employeeCountMin: number | null;
    employeeCountMax: number | null;
    employeeCountLabel: string | null;
    sector: string | null;
    city: string | null;
    region: string | null;
  };
  evidence: ProspectEvidenceBundle;
  steps: BoundedEnrichmentStepResult[];
  budget: BoundedEnrichmentBudget;
  enrichmentSucceeded: boolean;
  enrichmentIncompleteReason: string | null;
};