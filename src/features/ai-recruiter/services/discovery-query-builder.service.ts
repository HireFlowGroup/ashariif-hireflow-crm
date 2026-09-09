import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";

export type DiscoveryQueryVariant = {
  query: string;
  intent:
    | "company_discovery"
    | "vacancy"
    | "careers"
    | "company"
    | "job_board"
    | "role_specific"
    | "vacancy_source"
    | "vacancy_detail";
  label: string;
  location: string;
  role: string;
};

const NEGATIVE_AGGREGATOR_TERMS =
  "-indeed -linkedin -jooble -glassdoor -werkenbij -monster -stepstone -nationalevacaturebank -jobbird";

const ROLE_SYNONYMS: Record<string, string[]> = {
  recruiter: ["recruiter", "recruitment", "HR recruiter"],
  accountmanager: ["accountmanager", "account manager", "sales manager"],
  "customer success manager": ["customer success manager", "customer success", "CSM"],
};

function uniqueQueries(queries: DiscoveryQueryVariant[]): DiscoveryQueryVariant[] {
  const seen = new Set<string>();
  return queries.filter((entry) => {
    const key = entry.query.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function expandSynonyms(value: string, map: Record<string, string[]>): string[] {
  const key = value.toLowerCase().trim();
  return map[key] ?? [value];
}

/** Map user desired roles to canonical vacancy search roles. */
export function primaryDesiredRoles(roles: string[]): string[] {
  const canonical: string[] = [];
  for (const role of roles) {
    const normalized = role.toLowerCase().trim();
    if (/recruit/.test(normalized)) canonical.push("recruiter");
    else if (/account/.test(normalized)) canonical.push("accountmanager");
    else if (/customer|csm/.test(normalized)) canonical.push("customer success manager");
    else canonical.push(role);
  }
  return [...new Set(canonical)];
}

function vacancyQueryTemplates(input: {
  sector: string;
  location: string;
  role: string;
}): DiscoveryQueryVariant[] {
  const { sector, location, role } = input;
  return [
    {
      query: joinParts([role, "vacature", location, sector, "bedrijf", NEGATIVE_AGGREGATOR_TERMS]),
      intent: "role_specific",
      label: `${role} vacature ${location}`,
      location,
      role,
    },
    {
      query: joinParts([
        "vacature",
        role,
        location,
        sector,
        "inurl:vacatures OR inurl:careers OR inurl:jobs",
        NEGATIVE_AGGREGATOR_TERMS,
      ]),
      intent: "vacancy_detail",
      label: `Employer vacature ${role} ${location}`,
      location,
      role,
    },
    {
      query: joinParts(['"werken bij"', role, location, sector, NEGATIVE_AGGREGATOR_TERMS]),
      intent: "careers",
      label: `Werken bij ${role} ${location}`,
      location,
      role,
    },
    {
      query: joinParts(["softwarebedrijf", location, "vacature", role, NEGATIVE_AGGREGATOR_TERMS]),
      intent: "vacancy",
      label: `Software vacature ${role} ${location}`,
      location,
      role,
    },
  ];
}

export function buildVacancyDrivenDiscoveryQueries(
  criteria: CompanySearchCriteria,
  plan?: AiRecruiterSearchPlan,
): DiscoveryQueryVariant[] {
  const sector = criteria.sector ?? plan?.sectors?.[0] ?? criteria.sectors?.[0] ?? "software";

  const locations = [
    ...(criteria.locations ?? []),
    ...(criteria.city ? [criteria.city] : []),
    ...(plan?.locations ?? []),
  ].filter(Boolean);
  const allLocations = [...new Set(locations.length ? locations : ["Rotterdam", "Den Haag"])];

  const roles = plan?.desired_roles?.length
    ? plan.desired_roles
    : criteria.desiredRoles?.length
      ? criteria.desiredRoles
      : criteria.vacancyTitles?.length
        ? criteria.vacancyTitles
        : ["recruiter", "accountmanager", "customer success manager"];

  const canonicalRoles = primaryDesiredRoles(roles);
  const queries: DiscoveryQueryVariant[] = [];

  for (const location of allLocations.slice(0, 6)) {
    for (const role of canonicalRoles) {
      queries.push(...vacancyQueryTemplates({ sector, location, role }));
    }
  }

  return uniqueQueries(queries);
}

/**
 * Select queries with guaranteed location × role coverage.
 * Vacancy-focused intents are prioritized; generic company lists are excluded.
 */
export function selectDiscoveryQueries(
  queries: DiscoveryQueryVariant[],
  _maximumCompanies?: number,
): DiscoveryQueryVariant[] {
  const config = getAiRecruiterConfig();
  const target = config.discoveryQueryCount;

  const buckets = new Map<string, DiscoveryQueryVariant[]>();
  for (const query of queries) {
    const key = `${query.location}|${query.role}`;
    const list = buckets.get(key) ?? [];
    list.push(query);
    buckets.set(key, list);
  }

  const pairKeys = [...buckets.keys()];
  const selected: DiscoveryQueryVariant[] = [];
  const seen = new Set<string>();

  while (selected.length < target) {
    let added = false;
    for (const key of pairKeys) {
      if (selected.length >= target) break;
      const bucket = buckets.get(key);
      if (!bucket?.length) continue;
      const next = bucket.shift()!;
      const dedupeKey = next.query.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      selected.push(next);
      added = true;
    }
    if (!added) break;
  }

  return selected.length >= config.minDiscoveryQueries
    ? selected
    : uniqueQueries(queries).slice(0, Math.max(target, config.minDiscoveryQueries));
}

/** @deprecated Use selectDiscoveryQueries — kept for backward compatibility in tests. */
export function scaleQueriesForMaxCompanies(
  queries: DiscoveryQueryVariant[],
  _maximumCompanies: number,
): DiscoveryQueryVariant[] {
  return selectDiscoveryQueries(queries);
}

export function buildVacancySearchQueriesForCompany(input: {
  companyName: string;
  domain?: string | null;
  roles?: string[];
}): string[] {
  const roles = input.roles?.length ? input.roles : ["recruiter", "accountmanager", "customer success manager"];
  const domain = input.domain?.replace(/^www\./, "") ?? null;
  const queries: string[] = [];

  if (domain) {
    queries.push(
      `site:${domain} vacatures`,
      `site:${domain} careers`,
      `site:${domain} werken bij`,
    );
  }

  for (const role of roles.slice(0, 3)) {
    queries.push(`"${input.companyName}" ${role} vacature`);
  }

  return [...new Set(queries)];
}
