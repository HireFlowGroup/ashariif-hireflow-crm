import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { ConstraintMatchStatus } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { parseEmployeeRangeFromLabel } from "@/features/ai-recruiter/services/employee-range-enrichment.service";
import { employeeLabelIsVerified } from "@/features/ai-recruiter/services/prospect-selection-evidence.service";

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function evaluateLocationConstraint(
  company: Company,
  plan: AiRecruiterSearchPlan,
): ConstraintMatchStatus {
  if (plan.locations.length === 0 && plan.regions.length === 0) return "matched";
  if (!company.city && !company.region) return "unknown";

  const city = normalize(company.city ?? "");
  const region = normalize(company.region ?? company.province ?? "");

  const locationMatch = plan.locations.some((loc) => {
    const needle = normalize(loc);
    if (needle === "nederland" || needle === "nl") {
      return (company.country ?? "NL").toUpperCase() === "NL";
    }
    return city.includes(needle) || region.includes(needle);
  });
  const regionMatch = plan.regions.some(
    (reg) => region.includes(normalize(reg)) || city.includes(normalize(reg)),
  );

  if (locationMatch || regionMatch) return "matched";
  if (plan.locations.some((loc) => /nederland|netherlands|\bnl\b/i.test(loc)) && (company.country ?? "NL") === "NL") {
    return "matched";
  }
  return "mismatched";
}

export function evaluateSectorConstraint(
  company: Company,
  plan: AiRecruiterSearchPlan,
): ConstraintMatchStatus {
  if (plan.sectors.length === 0) return "matched";
  if (!company.sector) return "unknown";

  const sector = normalize(company.sector);
  if (plan.sectors.some((s) => sector.includes(normalize(s)))) return "matched";
  return "mismatched";
}

/** Resolveer min/max uit CRM-kolommen of geverifieerd label (geen AI-schattingen). */
export function resolveCompanyEmployeeRangeBounds(company: Company): {
  min: number | null;
  max: number | null;
} {
  if (company.employeeCountMin !== null || company.employeeCountMax !== null) {
    return {
      min: company.employeeCountMin,
      max: company.employeeCountMax,
    };
  }

  const label = company.employeeCountLabel;
  if (!label?.trim()) {
    return { min: null, max: null };
  }

  const parsed = parseEmployeeRangeFromLabel(label);
  if (!parsed) {
    return { min: null, max: null };
  }

  if (!employeeLabelIsVerified(label) && !/bewijs in bron/i.test(label)) {
    return { min: null, max: null };
  }

  return {
    min: parsed.min,
    max: parsed.max ?? parsed.min,
  };
}

export function evaluateEmployeeRangeConstraint(
  company: Company,
  plan: AiRecruiterSearchPlan,
): ConstraintMatchStatus {
  const { min, max } = plan.employee_range;
  if (min === null && max === null) return "matched";

  const { min: companyMin, max: companyMax } = resolveCompanyEmployeeRangeBounds(company);
  if (companyMin === null && companyMax === null) return "unknown";

  const effectiveMin = companyMin ?? companyMax ?? 0;
  const effectiveMax = companyMax ?? companyMin ?? 9999;
  const planMin = min ?? 0;
  const planMax = max ?? 9999;

  if (effectiveMax >= planMin && effectiveMin <= planMax) return "matched";
  return "mismatched";
}
