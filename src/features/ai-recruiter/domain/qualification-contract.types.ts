import type { ConceptEligibilityReasonCode } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { ConstraintMatchStatus } from "@/features/ai-recruiter/domain/concept-eligibility.types";

/** Version bump when contract semantics change (diagnostics / audit). */
export const QUALIFICATION_CONTRACT_VERSION = "p0-r2-v1";

export type QualificationStatus = "eligible" | "needs_evidence" | "rejected";

/**
 * Drempelverantwoordelijkheden (harmonisatie 70 vs 30):
 * - `commercial_*` — plan `minimum_hiring_score` / `minimum_opportunity_score` (default 70): commerciële relevantie voor opdracht.
 * - `concept_readiness` — `AI_RECRUITER_CONCEPT_SCORE_THRESHOLD` (default 30): deterministische prospectscore voor conceptgeneratie.
 */
export type QualificationThresholdKey =
  | "commercial_hiring"
  | "commercial_opportunity"
  | "concept_readiness";

export type QualificationThresholds = {
  contractVersion: typeof QUALIFICATION_CONTRACT_VERSION;
  commercialHiringMin: number;
  commercialOpportunityMin: number;
  conceptReadinessMin: number;
  responsibilityNotes: Record<QualificationThresholdKey, string>;
};

export type HardSelectionCriterion =
  | "contact_present"
  | "vacancy_required_met"
  | "desired_role_met"
  | "employee_range_matched"
  | "location_matched"
  | "sector_matched"
  | "no_duplicate_outreach"
  | "no_suppressed_contact";

export type EvidenceQualityDimension = "employee_range" | "sector" | "location";

export type EvidenceQualityLevel = "verified" | "unknown" | "contradicted";

export type QualificationCommercialAssessment = {
  hiringScore: number | null;
  opportunityScore: number | null;
  hiringThreshold: number;
  opportunityThreshold: number;
  hiringPassed: boolean;
  opportunityPassed: boolean;
  passed: boolean;
  summary: string;
};

export type QualificationConceptReadiness = {
  deterministicScore: number;
  threshold: number;
  passed: boolean;
  priority: string;
};

export type QualificationHardSelection = {
  passed: boolean;
  failedCriteria: HardSelectionCriterion[];
  blockingReasonCode: ConceptEligibilityReasonCode | null;
};

export type QualificationEvidenceQuality = {
  employeeRange: EvidenceQualityLevel;
  sector: EvidenceQualityLevel;
  location: EvidenceQualityLevel;
  /** True when any dimension is unknown (P0-R2: route to needs_evidence). */
  hasUnknownDimensions: boolean;
  summary: string;
};

export type QualificationContractSnapshot = {
  version: typeof QUALIFICATION_CONTRACT_VERSION;
  thresholds: QualificationThresholds;
  qualificationStatus: QualificationStatus;
  hardSelection: QualificationHardSelection;
  evidenceQuality: QualificationEvidenceQuality;
  commercial: QualificationCommercialAssessment;
  conceptReadiness: QualificationConceptReadiness;
  /** Overall concept dispatch eligible (all layers that apply). */
  conceptEligible: boolean;
  missingEvidence: string[];
  enrichmentBlockedReason: string | null;
  primaryReasonCode: ConceptEligibilityReasonCode;
  userMessage: string;
  evaluatedAt: string;
};

export function constraintStatusToEvidenceLevel(status: ConstraintMatchStatus): EvidenceQualityLevel {
  if (status === "matched") return "verified";
  if (status === "mismatched") return "contradicted";
  return "unknown";
}