import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { evaluateEmployeeRangeConstraint } from "@/features/ai-recruiter/services/company-constraint-validation.service";

export type EmployeeRangeEvidenceState =
  | "verified"
  | "unknown"
  | "conflicting"
  | "outside_required_range";

export function classifyEmployeeRangeEvidence(
  company: Company,
  plan: AiRecruiterSearchPlan,
): EmployeeRangeEvidenceState {
  const required = plan.employee_range.min !== null || plan.employee_range.max !== null;
  if (!required) return "verified";

  const min = company.employeeCountMin;
  const max = company.employeeCountMax;

  if (min !== null && max !== null && min > max) {
    return "conflicting";
  }

  const constraint = evaluateEmployeeRangeConstraint(company, plan);
  if (constraint === "unknown") return "unknown";
  if (constraint === "matched") {
    return min !== null || max !== null ? "verified" : "unknown";
  }
  if (min === null && max === null) return "unknown";
  return "outside_required_range";
}