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
    | "vacancy_source";
  label: string;
};

const SECTOR_SYNONYMS: Record<string, string[]> = {
  software: ["software", "IT", "SaaS", "tech", "software development"],
  it: ["IT", "software", "tech", "informatietechnologie"],
  saas: ["SaaS", "software", "cloud software"],
};

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

export function buildVacancyDrivenDiscoveryQueries(
  criteria: CompanySearchCriteria,
  plan?: AiRecruiterSearchPlan,
): DiscoveryQueryVariant[] {
  const config = getAiRecruiterConfig();
  const sector = criteria.sector ?? plan?.sectors?.[0] ?? criteria.sectors?.[0] ?? "software";
  const sectorTerms = expandSynonyms(sector, SECTOR_SYNONYMS).slice(0, 2);

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

  const normalizedRoles = roles.flatMap((role) => expandSynonyms(role, ROLE_SYNONYMS)).slice(0, 6);
  const queries: DiscoveryQueryVariant[] = [];

  // --- BEDRIJFSDISCOVERY ---
  for (const loc of allLocations.slice(0, 4)) {
    for (const term of sectorTerms) {
      queries.push(
        {
          query: joinParts([`${term}bedrijven`, loc]),
          intent: "company_discovery",
          label: `${term} bedrijven ${loc}`,
        },
        {
          query: joinParts(["IT bedrijven", loc]),
          intent: "company_discovery",
          label: `IT bedrijven ${loc}`,
        },
        {
          query: joinParts(["SaaS bedrijven", loc]),
          intent: "company_discovery",
          label: `SaaS bedrijven ${loc}`,
        },
        {
          query: joinParts(["software development bedrijven", loc]),
          intent: "company_discovery",
          label: `Software development ${loc}`,
        },
        {
          query: joinParts(["tech bedrijven", loc, "vacatures"]),
          intent: "company_discovery",
          label: `Tech vacatures ${loc}`,
        },
      );
    }
  }

  // --- VACATUREGEDREVEN ---
  for (const loc of allLocations.slice(0, 4)) {
    for (const role of normalizedRoles.slice(0, 3)) {
      queries.push({
        query: joinParts(["softwarebedrijf", loc, "vacatures", role]),
        intent: "vacancy",
        label: `Vacature ${role} ${loc}`,
      });
    }
    queries.push(
      {
        query: joinParts(['"werken bij"', "software", loc]),
        intent: "careers",
        label: `Werken bij software ${loc}`,
      },
      {
        query: joinParts(['"careers"', "SaaS", loc]),
        intent: "careers",
        label: `Careers SaaS ${loc}`,
      },
    );
  }

  // --- VACATUREBRONNEN ---
  if (config.includeVacancySources) {
    for (const loc of allLocations.slice(0, 3)) {
      const role = normalizedRoles[0] ?? "vacature";
      queries.push(
        {
          query: `site:indeed.com ${sector} ${loc} ${role}`,
          intent: "vacancy_source",
          label: `Indeed ${loc}`,
        },
        {
          query: `site:linkedin.com/jobs ${sector} ${loc} ${normalizedRoles[1] ?? "customer success"}`,
          intent: "vacancy_source",
          label: `LinkedIn Jobs ${loc}`,
        },
        {
          query: `site:nationalevacaturebank.nl ${sector} ${loc}`,
          intent: "vacancy_source",
          label: `NVB ${loc}`,
        },
        {
          query: `site:werkenbij.nl ${sector} ${loc}`,
          intent: "vacancy_source",
          label: `Werkenbij.nl ${loc}`,
        },
        {
          query: `site:company.info ${sector} ${loc}`,
          intent: "vacancy_source",
          label: `Company.info ${loc}`,
        },
        {
          query: `site:glassdoor.nl ${sector} ${loc} vacatures`,
          intent: "vacancy_source",
          label: `Glassdoor ${loc}`,
        },
      );
    }
  }

  // --- ROL-SPECIFIEK ---
  for (const role of normalizedRoles.slice(0, 4)) {
    queries.push({
      query: joinParts([role, allLocations[0] ?? "Nederland", sector, "vacature"]),
      intent: "role_specific",
      label: `Rol ${role}`,
    });
  }

  return uniqueQueries(queries);
}

/** Select a balanced mix of queries up to configured count. */
export function selectDiscoveryQueries(
  queries: DiscoveryQueryVariant[],
  _maximumCompanies?: number,
): DiscoveryQueryVariant[] {
  const config = getAiRecruiterConfig();
  const target = config.discoveryQueryCount;
  const intentOrder: DiscoveryQueryVariant["intent"][] = [
    "company_discovery",
    "vacancy",
    "careers",
    "vacancy_source",
    "role_specific",
    "company",
    "job_board",
  ];

  const buckets = new Map<DiscoveryQueryVariant["intent"], DiscoveryQueryVariant[]>();
  for (const query of queries) {
    const list = buckets.get(query.intent) ?? [];
    list.push(query);
    buckets.set(query.intent, list);
  }

  const selected: DiscoveryQueryVariant[] = [];
  const seen = new Set<string>();

  while (selected.length < target) {
    let added = false;
    for (const intent of intentOrder) {
      if (selected.length >= target) break;
      const bucket = buckets.get(intent);
      if (!bucket?.length) continue;
      const next = bucket.shift()!;
      const key = next.query.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
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
