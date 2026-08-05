import { z } from "zod";

export const conceptEligibilityReasonCodeSchema = z.enum([
  "eligible",
  "no_active_vacancy",
  "no_contact",
  "invalid_contact",
  "suppressed_contact",
  "score_below_threshold",
  "wrong_location",
  "wrong_sector",
  "invalid_company",
  "duplicate_outreach",
  "cooldown_active",
  "missing_required_data",
  "manual_override",
  "unknown",
]);

export type ConceptEligibilityReasonCode = z.infer<typeof conceptEligibilityReasonCodeSchema>;

export const prospectResultTypeSchema = z.enum([
  "company",
  "vacancy",
  "company_careers_page",
  "vacancy_board",
  "directory",
  "article",
  "search_result_page",
  "unknown",
]);

export type ProspectResultType = z.infer<typeof prospectResultTypeSchema>;

export type ConceptEligibilityResult = {
  eligible: boolean;
  score: number;
  threshold: number;
  priority: "priority_a" | "priority_b" | "priority_c" | "low_priority" | "reject";
  acceptedRules: string[];
  rejectedRules: string[];
  reasonCode: ConceptEligibilityReasonCode;
  userMessage: string;
};

export type VacancyEvidence = {
  title: string;
  companyName: string | null;
  location: string | null;
  sourceUrl: string;
  sourceDomain: string;
  publishedAt: string | null;
  validThrough: string | null;
  employmentType: string | null;
  department: string | null;
  hiringSignalStrength: number;
  isActive: boolean;
  validationReason: string;
  actuality: "known" | "unknown";
};

export type ProspectAuditDecision = {
  runId: string;
  prospectId: string;
  companyName: string;
  companyDomain: string | null;
  sourceUrl: string | null;
  sourceType: ProspectResultType | null;
  vacancyTitle: string | null;
  vacancyUrl: string | null;
  vacancySource: string | null;
  location: string | null;
  sector: string | null;
  employeeRange: string | null;
  companyValidationStatus: string | null;
  vacancyValidationStatus: string | null;
  contactType: string | null;
  contactEmail: string | null;
  contactVerificationStatus: string | null;
  contactScore: number | null;
  opportunityScore: number | null;
  eligibilityStatus: "eligible" | "ineligible" | "manual_override";
  conceptStatus: "pending" | "created" | "skipped" | "failed";
  acceptedRules: string[];
  rejectedRules: string[];
  finalDecision: string;
  finalReason: string;
  manualEligibilityOverride: boolean;
  createdAt: string;
};
