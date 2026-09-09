import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  isDirectoryDomain,
  isVacancyBoardDomain,
} from "@/features/company-finder/discovery/discovery-domain-blocklist";
import { detectRecruitmentCompetitor } from "@/features/company-finder/discovery/competitor-detection.service";
import type { DiscoveryResultType } from "@/features/company-finder/discovery/discovery-result.types";

export type DiscoveryEmployerRejectReason =
  | "vacancy_board"
  | "directory"
  | "recruitment_agency_excluded"
  | null;

/** Whether recruitment/staffing agencies should be excluded for this search plan. */
export function shouldExcludeRecruitmentAgenciesForPlan(
  plan: Pick<AiRecruiterSearchPlan, "sectors" | "desired_roles" | "reasoning">,
  configExcludeRecruitmentAgencies: boolean,
): boolean {
  if (!configExcludeRecruitmentAgencies) return false;

  const hint = [
    ...plan.sectors,
    ...plan.desired_roles,
    plan.reasoning ?? "",
  ].join(" ").toLowerCase();

  if (
    /uitzend|staffing|recruitment agency|recruitmentbureau|detacherings|personeelsbureau|recruitment.?bureau|bureau.?recruit|werving.?selectie.?bureau/.test(
      hint,
    )
  ) {
    return false;
  }

  return true;
}

/** Criteria-aware employer gate — blocks non-target employers before prospect save. */
export function evaluateDiscoveryEmployerForSave(input: {
  name: string;
  domain: string | null;
  url?: string | null;
  resultType?: DiscoveryResultType | string | null;
  excludeRecruitmentAgencies: boolean;
  plan?: Pick<AiRecruiterSearchPlan, "sectors" | "desired_roles" | "reasoning">;
}): { acceptable: boolean; reason: DiscoveryEmployerRejectReason } {
  const domain = input.domain?.toLowerCase().replace(/^www\./, "") ?? "";
  const url = input.url ?? (domain ? `https://${domain}` : "");

  if (domain && isVacancyBoardDomain(url)) {
    return { acceptable: false, reason: "vacancy_board" };
  }

  if (domain && isDirectoryDomain(url)) {
    return { acceptable: false, reason: "directory" };
  }

  if (
    input.resultType === "vacancy_board"
    || input.resultType === "business_directory"
    || input.resultType === "recruitment_agency"
  ) {
    if (input.resultType === "recruitment_agency") {
      const excludeAgencies = input.plan
        ? shouldExcludeRecruitmentAgenciesForPlan(input.plan, input.excludeRecruitmentAgencies)
        : input.excludeRecruitmentAgencies;
      if (excludeAgencies) {
        return { acceptable: false, reason: "recruitment_agency_excluded" };
      }
    } else {
      return {
        acceptable: false,
        reason: input.resultType === "business_directory" ? "directory" : "vacancy_board",
      };
    }
  }

  const excludeAgencies = input.plan
    ? shouldExcludeRecruitmentAgenciesForPlan(input.plan, input.excludeRecruitmentAgencies)
    : input.excludeRecruitmentAgencies;

  if (excludeAgencies) {
    const competitor = detectRecruitmentCompetitor({
      title: input.name,
      url,
      description: null,
    });
    if (competitor.isCompetitor) {
      return { acceptable: false, reason: "recruitment_agency_excluded" };
    }
  }

  return { acceptable: true, reason: null };
}
