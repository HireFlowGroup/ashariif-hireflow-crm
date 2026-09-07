import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";

type RoleMatchGroup = {
  keys: string[];
  patterns: RegExp[];
};

const ROLE_MATCH_GROUPS: RoleMatchGroup[] = [
  {
    keys: ["recruiter", "recruiters", "recruitment", "hr recruiter", "talent acquisition"],
    patterns: [
      /\brecruiter\b/i,
      /\btalent acquisition\b/i,
      /\bcorporate recruiter\b/i,
      /\brecruitment specialist\b/i,
      /\bwervings(?:adviseur|consultant)?\b/i,
    ],
  },
  {
    keys: ["accountmanager", "account manager", "accountmanagers", "sales account manager"],
    patterns: [
      /\baccount\s?manager\b/i,
      /\baccountmanager\b/i,
      /\bsales account manager\b/i,
    ],
  },
  {
    keys: [
      "customer success manager",
      "customer success",
      "customer success managers",
      "client success",
      "csm",
    ],
    patterns: [
      /\bcustomer success(?: manager| specialist| lead)?\b/i,
      /\bclient success(?: manager| specialist)?\b/i,
      /\bcsm\b/i,
    ],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function desiredRoleGroups(desiredRoles: string[]): RoleMatchGroup[] {
  if (desiredRoles.length === 0) return ROLE_MATCH_GROUPS;

  const normalizedDesired = desiredRoles.map(normalize);
  return ROLE_MATCH_GROUPS.filter((group) =>
    group.keys.some((key) =>
      normalizedDesired.some(
        (desired) => desired.includes(normalize(key)) || normalize(key).includes(desired),
      ),
    ),
  );
}

export function vacancyTitleMatchesDesiredRoles(
  vacancyTitle: string,
  plan: AiRecruiterSearchPlan,
): boolean {
  if (plan.desired_roles.length === 0) return true;

  const title = normalize(vacancyTitle);
  const groups = desiredRoleGroups(plan.desired_roles);

  return groups.some((group) => group.patterns.some((pattern) => pattern.test(title)));
}

export function findMatchingDesiredRoles(
  vacancyTitle: string,
  plan: AiRecruiterSearchPlan,
): string[] {
  if (plan.desired_roles.length === 0) return [];

  const title = normalize(vacancyTitle);
  const groups = desiredRoleGroups(plan.desired_roles);
  const matches = new Set<string>();

  for (const group of groups) {
    if (group.patterns.some((pattern) => pattern.test(title))) {
      for (const desired of plan.desired_roles) {
        if (group.keys.some((key) => normalize(desired).includes(normalize(key)) || normalize(key).includes(normalize(desired)))) {
          matches.add(desired);
        }
      }
    }
  }

  return [...matches];
}
