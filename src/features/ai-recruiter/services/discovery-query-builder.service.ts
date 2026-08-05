import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";

export type DiscoveryQueryVariant = {
  query: string;
  intent: "vacancy" | "careers" | "company" | "job_board" | "role_specific";
  label: string;
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

export function buildVacancyDrivenDiscoveryQueries(
  criteria: CompanySearchCriteria,
  plan?: AiRecruiterSearchPlan,
): DiscoveryQueryVariant[] {
  const config = getAiRecruiterConfig();
  const sector = criteria.sector ?? plan?.sectors?.[0] ?? criteria.sectors?.[0] ?? "software";
  const locations = [
    ...(criteria.locations ?? []),
    ...(criteria.city ? [criteria.city] : []),
    ...(plan?.locations ?? []),
  ].filter(Boolean);
  const city = locations[0] ?? plan?.locations[0] ?? criteria.city ?? "";
  const region = criteria.region ?? plan?.regions[0] ?? criteria.regions?.[0] ?? "";
  const location = joinParts([city, region]) || "Nederland";
  const allLocations = [...new Set(locations.length ? locations : [location])];
  const roles = plan?.desired_roles?.length
    ? plan.desired_roles
    : criteria.desiredRoles?.length
      ? criteria.desiredRoles
      : criteria.vacancyTitles?.length
        ? criteria.vacancyTitles
        : criteria.keywords
          ? criteria.keywords.split(",").map((k) => k.trim()).filter(Boolean)
          : ["recruiter", "accountmanager", "customer success manager"];

  const queries: DiscoveryQueryVariant[] = [];

  for (const loc of allLocations.slice(0, 4)) {
    for (const role of roles.slice(0, 3)) {
      queries.push({
        query: joinParts([sector, loc, "vacatures", role]),
        intent: "vacancy",
        label: `Vacature ${role} ${loc}`,
      });
    }
    queries.push(
      {
        query: joinParts([sector, loc, "werken bij", "vacatures"]),
        intent: "careers",
        label: `Werken bij ${loc}`,
      },
      {
        query: `site:indeed.nl ${sector} ${loc} ${roles[0] ?? "vacature"}`,
        intent: "job_board",
        label: `Indeed ${loc}`,
      },
      {
        query: `site:linkedin.com/jobs ${sector} ${loc} ${roles[0] ?? "recruiter"}`,
        intent: "job_board",
        label: `LinkedIn Jobs ${loc}`,
      },
    );
  }

  for (const role of roles.slice(0, 4)) {
    queries.push({
      query: joinParts([sector, location, "vacatures", role]),
      intent: "vacancy",
      label: `Vacature ${role}`,
    });
    queries.push({
      query: joinParts([`${role}`, location, sector, "vacature"]),
      intent: "role_specific",
      label: `Rol ${role}`,
    });
  }

  queries.push(
    {
      query: joinParts([sector, location, "werken bij", "vacatures"]),
      intent: "careers",
      label: "Werken bij",
    },
    {
      query: joinParts([sector, location, "careers", "openstaande functies"]),
      intent: "careers",
      label: "Careers pagina",
    },
    {
      query: joinParts([sector, "bedrijf", location, "vacatures recruiter"]),
      intent: "vacancy",
      label: "Recruitment vacatures",
    },
    {
      query: joinParts([sector, location, "SaaS", "vacatures"]),
      intent: "vacancy",
      label: "SaaS vacatures",
    },
    {
      query: `site:indeed.nl ${sector} ${location} ${roles[0] ?? "vacature"}`,
      intent: "job_board",
      label: "Indeed",
    },
    {
      query: `site:linkedin.com/jobs ${sector} ${location} ${roles[0] ?? "recruiter"}`,
      intent: "job_board",
      label: "LinkedIn Jobs",
    },
    {
      query: `site:nationalevacaturebank.nl ${sector} ${location}`,
      intent: "job_board",
      label: "NVB",
    },
    {
      query: `site:werkenbij.nl ${sector} ${location}`,
      intent: "job_board",
      label: "Werkenbij.nl",
    },
    {
      query: joinParts(['"vacatures"', `"${sector}"`, `"${city || location}"`]),
      intent: "vacancy",
      label: "Vacature intentie",
    },
    {
      query: joinParts([sector, location, "recruitment opdracht hiring behoefte Nederland"]),
      intent: "company",
      label: "Algemene recruitment zoekopdracht",
    },
  );

  const minQueries = Math.max(config.minDiscoveryQueries, 5);
  return uniqueQueries(queries).slice(0, Math.max(minQueries, 12));
}

export function scaleQueriesForMaxCompanies(
  queries: DiscoveryQueryVariant[],
  maximumCompanies: number,
): DiscoveryQueryVariant[] {
  const minQueries = Math.max(5, Math.ceil(maximumCompanies / 5));
  return queries.slice(0, minQueries);
}
