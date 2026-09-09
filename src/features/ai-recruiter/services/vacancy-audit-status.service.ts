import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { vacancyTitleMatchesDesiredRoles } from "@/features/ai-recruiter/services/desired-role-matching.service";
import {
  filterStrictVacancyEvidence,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";

export type VacancyAuditStatus =
  | "found"
  | "matched"
  | "no_matching_role"
  | "noise"
  | "none";

export function resolveVacancyAuditStatus(input: {
  vacancies: VacancyEvidence[];
  plan: AiRecruiterSearchPlan;
  parsedVacancyCount?: number;
}): VacancyAuditStatus {
  const strict = filterStrictVacancyEvidence(input.vacancies);

  if (strict.length === 0) {
    if (input.vacancies.some((item) => !strictVacancyEvidence(item))) return "noise";
    if ((input.parsedVacancyCount ?? 0) > 0) return "noise";
    return "none";
  }

  if (input.plan.desired_roles.length > 0) {
    const roleMatched = strict.filter((vacancy) =>
      vacancyTitleMatchesDesiredRoles(vacancy.jobTitle || vacancy.title, input.plan),
    );
    if (roleMatched.length > 0) return "matched";
    return "no_matching_role";
  }

  return "found";
}
