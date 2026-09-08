import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { ConstraintMatchStatus } from "@/features/ai-recruiter/domain/concept-eligibility.types";

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

  const locationMatch = plan.locations.some((loc) => city.includes(normalize(loc)));
  const regionMatch = plan.regions.some(
    (reg) => region.includes(normalize(reg)) || city.includes(normalize(reg)),
  );

  if (locationMatch || regionMatch) return "matched";
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

export function evaluateEmployeeRangeConstraint(
  company: Company,
  plan: AiRecruiterSearchPlan,
): ConstraintMatchStatus {
  const { min, max } = plan.employee_range;
  if (min === null && max === null) return "matched";

  const companyMin = company.employeeCountMin;
  const companyMax = company.employeeCountMax;
  if (companyMin === null && companyMax === null) return "unknown";

  const effectiveMin = companyMin ?? companyMax ?? 0;
  const effectiveMax = companyMax ?? companyMin ?? 9999;
  const planMin = min ?? 0;
  const planMax = max ?? 9999;

  if (effectiveMax >= planMin && effectiveMin <= planMax) return "matched";
  return "mismatched";
}
