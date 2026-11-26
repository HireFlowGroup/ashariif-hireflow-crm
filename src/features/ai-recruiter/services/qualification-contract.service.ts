import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { ConceptEligibilityReasonCode } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import {
  QUALIFICATION_CONTRACT_VERSION,
  type QualificationCommercialAssessment,
  type QualificationConceptReadiness,
  type QualificationContractSnapshot,
  type QualificationEvidenceQuality,
  type QualificationHardSelection,
  type QualificationThresholds,
  constraintStatusToEvidenceLevel,
} from "@/features/ai-recruiter/domain/qualification-contract.types";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import {
  evaluateEmployeeRangeConstraint,
  evaluateLocationConstraint,
  evaluateSectorConstraint,
} from "@/features/ai-recruiter/services/company-constraint-validation.service";

export function resolveQualificationThresholds(plan: AiRecruiterSearchPlan): QualificationThresholds {
  const config = getAiRecruiterConfig();

  return {
    contractVersion: QUALIFICATION_CONTRACT_VERSION,
    commercialHiringMin: plan.minimum_hiring_score,
    commercialOpportunityMin: plan.minimum_opportunity_score,
    conceptReadinessMin: config.conceptScoreThreshold,
    responsibilityNotes: {
      commercial_hiring:
        `Hiring-intelligence score ≥ ${plan.minimum_hiring_score} (uit parsed search plan — commerciële opdrachtrelevantie).`,
      commercial_opportunity:
        `Opportunity score ≥ ${plan.minimum_opportunity_score} (uit parsed search plan — recruitment potential).`,
      concept_readiness:
        `Deterministische prospectscore ≥ ${config.conceptScoreThreshold} (platformdrempel voor conceptgeneratie).`,
    },
  };
}

export function assessEvidenceQuality(company: Company, plan: AiRecruiterSearchPlan): QualificationEvidenceQuality {
  const employeeRange = constraintStatusToEvidenceLevel(evaluateEmployeeRangeConstraint(company, plan));
  const sector = constraintStatusToEvidenceLevel(evaluateSectorConstraint(company, plan));
  const location = constraintStatusToEvidenceLevel(evaluateLocationConstraint(company, plan));

  const hasUnknownDimensions =
    employeeRange === "unknown" || sector === "unknown" || location === "unknown";

  const parts: string[] = [];
  if (employeeRange === "unknown") parts.push("medewerkersaantal onbekend");
  if (sector === "unknown") parts.push("sector onbekend");
  if (location === "unknown") parts.push("locatie onbekend");
  if (employeeRange === "contradicted") parts.push("medewerkersaantal buiten range");
  if (sector === "contradicted") parts.push("sector niet passend");
  if (location === "contradicted") parts.push("locatie niet passend");

  const summary =
    parts.length > 0
      ? parts.join("; ")
      : "Vereiste dimensies hebben verifieerbaar bewijs of vallen buiten plan (contradicted).";

  return {
    employeeRange,
    sector,
    location,
    hasUnknownDimensions,
    summary,
  };
}

export function assessCommercialRelevance(input: {
  thresholds: QualificationThresholds;
  hiringScore: number | null;
  opportunityScore: number | null;
}): QualificationCommercialAssessment {
  const { thresholds, hiringScore, opportunityScore } = input;

  const hiringPassed =
    hiringScore !== null && hiringScore >= thresholds.commercialHiringMin;
  const opportunityPassed =
    opportunityScore !== null && opportunityScore >= thresholds.commercialOpportunityMin;

  const passed = hiringPassed && opportunityPassed;

  let summary: string;
  if (hiringScore === null || opportunityScore === null) {
    summary = "Onvoldoende commerciële scores beschikbaar voor beoordeling.";
  } else if (passed) {
    summary = `Commercieel voldoende: hiring ${hiringScore} (min ${thresholds.commercialHiringMin}), opportunity ${opportunityScore} (min ${thresholds.commercialOpportunityMin}).`;
  } else {
    const bits: string[] = [];
    if (!hiringPassed) {
      bits.push(`hiring ${hiringScore} < ${thresholds.commercialHiringMin}`);
    }
    if (!opportunityPassed) {
      bits.push(`opportunity ${opportunityScore} < ${thresholds.commercialOpportunityMin}`);
    }
    summary = `Commercieel onvoldoende: ${bits.join("; ")}.`;
  }

  return {
    hiringScore,
    opportunityScore,
    hiringThreshold: thresholds.commercialHiringMin,
    opportunityThreshold: thresholds.commercialOpportunityMin,
    hiringPassed,
    opportunityPassed,
    passed,
    summary,
  };
}

export function buildQualificationContractSnapshot(input: {
  plan: AiRecruiterSearchPlan;
  company: Company;
  qualificationStatus: import("@/features/ai-recruiter/domain/qualification-contract.types").QualificationStatus;
  hardSelection: QualificationHardSelection;
  conceptReadiness: QualificationConceptReadiness;
  commercial: QualificationCommercialAssessment;
  primaryReasonCode: ConceptEligibilityReasonCode;
  userMessage: string;
  conceptEligible: boolean;
  missingEvidence?: string[];
  enrichmentBlockedReason?: string | null;
}): QualificationContractSnapshot {
  const thresholds = resolveQualificationThresholds(input.plan);
  const evidenceQuality = assessEvidenceQuality(input.company, input.plan);

  return {
    version: QUALIFICATION_CONTRACT_VERSION,
    thresholds,
    qualificationStatus: input.qualificationStatus,
    hardSelection: input.hardSelection,
    evidenceQuality,
    commercial: input.commercial,
    conceptReadiness: input.conceptReadiness,
    conceptEligible: input.conceptEligible,
    missingEvidence: input.missingEvidence ?? evidenceQuality.summary ? [] : [],
    enrichmentBlockedReason: input.enrichmentBlockedReason ?? null,
    primaryReasonCode: input.primaryReasonCode,
    userMessage: input.userMessage,
    evaluatedAt: new Date().toISOString(),
  };
}

export function formatQualificationRunSummary(thresholds: QualificationThresholds): string {
  return [
    `conceptdrempel ${thresholds.conceptReadinessMin}`,
    `commercieel hiring ≥ ${thresholds.commercialHiringMin}`,
    `commercieel opportunity ≥ ${thresholds.commercialOpportunityMin}`,
  ].join(" · ");
}

export function enrichEligibilityWithContract(
  input: {
    company: Company;
    plan: AiRecruiterSearchPlan;
    hiringScore: number;
    opportunityScore?: number | null;
  },
  result: Omit<import("@/features/ai-recruiter/domain/concept-eligibility.types").ConceptEligibilityResult, "contract">,
  diagnostics?: {
    evidenceBundle?: import("@/features/ai-recruiter/domain/prospect-selection-evidence.types").ProspectEvidenceBundle;
    enrichmentDiagnostics?: import("@/features/ai-recruiter/domain/prospect-selection-evidence.types").BoundedEnrichmentResult | null;
  },
): import("@/features/ai-recruiter/domain/concept-eligibility.types").ConceptEligibilityResult {
  const thresholds = resolveQualificationThresholds(input.plan);
  const commercial = assessCommercialRelevance({
    thresholds,
    hiringScore: input.hiringScore,
    opportunityScore: input.opportunityScore ?? null,
  });

  const qualificationStatus = result.qualificationStatus;

  const hardSelection: QualificationHardSelection = {
    passed: qualificationStatus === "eligible",
    failedCriteria: [],
    blockingReasonCode: qualificationStatus === "eligible" ? null : result.reasonCode,
  };

  const conceptReadiness: QualificationConceptReadiness = {
    deterministicScore: result.score,
    threshold: thresholds.conceptReadinessMin,
    passed: result.score >= thresholds.conceptReadinessMin && result.reasonCode !== "score_below_threshold",
    priority: result.priority,
  };

  const missingEvidence =
    diagnostics?.evidenceBundle?.missingCriteria.map(String)
    ?? (qualificationStatus === "needs_evidence"
      ? result.rejectedRules.filter((r) => r.startsWith("needs_evidence:"))
      : []);

  const contract = buildQualificationContractSnapshot({
    plan: input.plan,
    company: input.company,
    qualificationStatus,
    hardSelection,
    conceptReadiness,
    commercial,
    primaryReasonCode: result.reasonCode,
    userMessage: result.userMessage,
    conceptEligible: qualificationStatus === "eligible",
    missingEvidence,
    enrichmentBlockedReason:
      diagnostics?.enrichmentDiagnostics?.enrichmentIncompleteReason
      ?? diagnostics?.enrichmentDiagnostics?.budget.stopReason
      ?? null,
  });

  return {
    ...result,
    threshold: thresholds.conceptReadinessMin,
    contract,
  };
}

export function applyCommercialRelevanceGate(input: {
  plan: AiRecruiterSearchPlan;
  hiringScore: number;
  opportunityScore: number | null | undefined;
  leadScore: number;
  conceptThreshold: number;
  priority: import("@/features/ai-recruiter/services/deterministic-lead-score.service").DeterministicLeadScoreResult["priority"];
  acceptedRules: string[];
  rejectedRules: string[];
}):
  | { ok: true }
  | {
      ok: false;
      reasonCode: ConceptEligibilityReasonCode;
      userMessage: string;
    } {
  const thresholds = resolveQualificationThresholds(input.plan);

  if (input.opportunityScore == null) {
    return {
      ok: false,
      reasonCode: "commercial_scores_missing",
      userMessage:
        "Opportunity score ontbreekt — commerciële beoordeling (plan-drempel) kan niet worden afgerond.",
    };
  }

  const commercial = assessCommercialRelevance({
    thresholds,
    hiringScore: input.hiringScore,
    opportunityScore: input.opportunityScore,
  });

  if (!commercial.hiringPassed) {
    return {
      ok: false,
      reasonCode: "commercial_hiring_below_plan",
      userMessage: `Hiring score ${input.hiringScore} onder planminimum ${thresholds.commercialHiringMin} (commerciële relevantie). Conceptdrempel ${thresholds.conceptReadinessMin} is hier niet van toepassing.`,
    };
  }

  if (!commercial.opportunityPassed) {
    return {
      ok: false,
      reasonCode: "commercial_opportunity_below_plan",
      userMessage: `Opportunity score ${input.opportunityScore} onder planminimum ${thresholds.commercialOpportunityMin} (commerciële relevantie). Conceptdrempel ${thresholds.conceptReadinessMin} is hier niet van toepassing.`,
    };
  }

  return { ok: true };
}