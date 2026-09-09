import "server-only";

import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { ConstraintMatchStatus } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { evaluateEmployeeRangeConstraint } from "@/features/ai-recruiter/services/company-constraint-validation.service";
import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import { classifyAndSummarizeLead } from "@/features/lead-intelligence/services/ai-classifier.service";
import { employeeRangeToMinMax } from "@/features/lead-intelligence/services/normalize";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";

export type EmployeeRangeEnrichmentOutcome = "match" | "mismatch" | "unknown";

export type EmployeeRangeEnrichmentResult = {
  company: Company;
  outcome: EmployeeRangeEnrichmentOutcome;
  enriched: boolean;
  employeeCountMin: number | null;
  employeeCountMax: number | null;
  employeeCountLabel: string | null;
};

const NUMERIC_RANGE_PATTERN = /(\d{1,5})\s*(?:tot|-|\u2013)\s*(\d{1,5})/i;

/** Parse free-text employee labels into min/max (e.g. "11-50 medewerkers", "20 tot 200"). */
export function parseEmployeeRangeFromLabel(
  label: string | null | undefined,
): { min: number | null; max: number | null } | null {
  if (!label?.trim()) return null;

  const normalized = label.toLowerCase().replace(/\s+/g, " ").trim();

  for (const bucket of ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const) {
    if (normalized.includes(bucket.replace("-", " ")) || normalized.includes(bucket)) {
      return employeeRangeToMinMax(bucket);
    }
  }

  const match = normalized.match(NUMERIC_RANGE_PATTERN);
  if (!match) return null;

  const min = Number.parseInt(match[1] ?? "", 10);
  const max = match[2] ? Number.parseInt(match[2], 10) : null;
  if (!Number.isFinite(min)) return null;

  return { min, max: max ?? min };
}

export function employeeRangeEnrichmentRequired(plan: AiRecruiterSearchPlan): boolean {
  return plan.employee_range.min !== null || plan.employee_range.max !== null;
}

export function companyNeedsEmployeeRangeEnrichment(company: Company): boolean {
  return company.employeeCountMin === null && company.employeeCountMax === null;
}

function toCandidate(company: Company): ExternalCompanyCandidate {
  return {
    externalId: company.id as string,
    name: company.name,
    normalizedName: company.name.toLowerCase(),
    website: company.website,
    domain: company.domain,
    linkedinUrl: company.linkedinUrl,
    email: company.email,
    phone: company.phone,
    city: company.city,
    region: company.region,
    province: company.province,
    country: company.country,
    sector: company.sector,
    employeeCountMin: company.employeeCountMin,
    employeeCountMax: company.employeeCountMax,
    employeeCountLabel: company.employeeCountLabel,
    description: company.aiSummary,
    careersUrl: company.careersUrl,
    vacancyPageUrl: company.vacancyPageUrl,
    generalEmail: company.generalEmail,
    hrEmail: company.hrEmail,
    kvkNumber: company.kvkNumber,
    aiSummary: company.aiSummary,
    source: company.source ?? "discovery",
    sourceUrl: company.sourceUrl,
    vacancyCount: company.vacancyCount,
    vacancyTitles: [],
    hiringSignals: company.hiringSignals,
    confidence: company.confidence ?? 0.5,
    discoveredAt: company.createdAt,
    lastVerifiedAt: company.lastVerifiedAt,
  };
}

function outcomeFromConstraint(status: ConstraintMatchStatus): EmployeeRangeEnrichmentOutcome {
  if (status === "matched") return "match";
  if (status === "mismatched") return "mismatch";
  return "unknown";
}

/** Attempt employee-range enrichment before final qualification when constraint is set. */
export async function enrichEmployeeRangeBeforeQualification(input: {
  company: Company;
  plan: AiRecruiterSearchPlan;
  criteria?: CompanySearchCriteria;
}): Promise<EmployeeRangeEnrichmentResult> {
  const { company, plan } = input;

  if (!employeeRangeEnrichmentRequired(plan)) {
    return {
      company,
      outcome: "match",
      enriched: false,
      employeeCountMin: company.employeeCountMin,
      employeeCountMax: company.employeeCountMax,
      employeeCountLabel: company.employeeCountLabel,
    };
  }

  if (!companyNeedsEmployeeRangeEnrichment(company)) {
    return {
      company,
      outcome: outcomeFromConstraint(evaluateEmployeeRangeConstraint(company, plan)),
      enriched: false,
      employeeCountMin: company.employeeCountMin,
      employeeCountMax: company.employeeCountMax,
      employeeCountLabel: company.employeeCountLabel,
    };
  }

  const criteria: CompanySearchCriteria = input.criteria ?? {
    city: company.city ?? undefined,
    region: company.region ?? undefined,
    sector: company.sector ?? undefined,
    employeeCountMin: plan.employee_range.min ?? undefined,
    employeeCountMax: plan.employee_range.max ?? undefined,
    locations: plan.locations,
    sectors: plan.sectors,
  };

  const aiResult = await classifyAndSummarizeLead(toCandidate(company), criteria);
  const parsed = parseEmployeeRangeFromLabel(aiResult.employeeCountLabel);

  if (!parsed) {
    return {
      company,
      outcome: "unknown",
      enriched: false,
      employeeCountMin: null,
      employeeCountMax: null,
      employeeCountLabel: aiResult.employeeCountLabel,
    };
  }

  const enrichedCompany: Company = {
    ...company,
    employeeCountMin: parsed.min,
    employeeCountMax: parsed.max,
    employeeCountLabel: aiResult.employeeCountLabel,
  };

  return {
    company: enrichedCompany,
    outcome: outcomeFromConstraint(evaluateEmployeeRangeConstraint(enrichedCompany, plan)),
    enriched: true,
    employeeCountMin: parsed.min,
    employeeCountMax: parsed.max,
    employeeCountLabel: aiResult.employeeCountLabel,
  };
}
