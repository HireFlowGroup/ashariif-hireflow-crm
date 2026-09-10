import "server-only";

import type { DiscoveryQueryVariant } from "@/features/ai-recruiter/services/discovery-query-builder.service";
import { primaryDesiredRoles } from "@/features/ai-recruiter/services/discovery-query-builder.service";
import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import {
  evaluateUsefulRecall,
  isConcreteVacancyDiscoveryResult,
  matchesDesiredRoleTitle,
} from "@/features/company-finder/discovery/discovery-useful-recall.service";
import type {
  RecallCoverageGap,
  UsableRecallDiagnostics,
} from "@/features/company-finder/discovery/discovery-usable-recall-diagnostics.types";
import { executeSerpApiDiscoveryQuery } from "@/features/company-finder/discovery/discovery-provider-runner.service";
import type { SearchResultItem } from "@/features/lead-intelligence/providers/manager/types";

const MIN_USABLE_PER_LOCATION = 1;
const MIN_USABLE_PER_ROLE = 1;

function countUsableAtLocation(
  enriched: EnrichedDiscoveryResult[],
  location: string,
  desiredRoles: string[],
): number {
  const normalizedLocation = location.toLowerCase();
  return enriched.filter((entry) => {
    if (!entry.accepted || !isConcreteVacancyDiscoveryResult(entry)) return false;
    if (!matchesDesiredRoleTitle(entry.vacancyTitle ?? entry.title, desiredRoles)) return false;
    const entryLocation = entry.discoveryLocation?.toLowerCase() ?? "";
    const query = entry.query.toLowerCase();
    return entryLocation.includes(normalizedLocation) || query.includes(normalizedLocation);
  }).length;
}

function countUsableForRole(
  enriched: EnrichedDiscoveryResult[],
  role: string,
  desiredRoles: string[],
): number {
  return enriched.filter((entry) => {
    if (!entry.accepted || !isConcreteVacancyDiscoveryResult(entry)) return false;
    if (entry.discoveryRole !== role) return false;
    return matchesDesiredRoleTitle(entry.vacancyTitle ?? entry.title, desiredRoles);
  }).length;
}

/** Identify location/role pairs that need supplemental SerpAPI retrieval. */
export function identifyRecallCoverageGaps(input: {
  enriched: EnrichedDiscoveryResult[];
  locations: string[];
  canonicalRoles: string[];
  desiredRoles: string[];
}): RecallCoverageGap[] {
  const gaps: RecallCoverageGap[] = [];
  const seen = new Set<string>();

  for (const location of input.locations) {
    const usable = countUsableAtLocation(input.enriched, location, input.desiredRoles);
    if (usable >= MIN_USABLE_PER_LOCATION) continue;

    for (const role of input.canonicalRoles) {
      const key = `${location}|${role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      gaps.push({
        location,
        role,
        reason: `Locatie ${location}: ${usable} usable vacancies (min ${MIN_USABLE_PER_LOCATION})`,
      });
    }
  }

  for (const role of input.canonicalRoles) {
    const usable = countUsableForRole(input.enriched, role, input.desiredRoles);
    if (usable >= MIN_USABLE_PER_ROLE) continue;

    for (const location of input.locations) {
      const key = `${location}|${role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      gaps.push({
        location,
        role,
        reason: `Rol ${role}: ${usable} usable vacancies (min ${MIN_USABLE_PER_ROLE})`,
      });
    }
  }

  return gaps;
}

export function buildLocationCoverageMap(
  enriched: EnrichedDiscoveryResult[],
  locations: string[],
  desiredRoles: string[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const location of locations) {
    map[location] = countUsableAtLocation(enriched, location, desiredRoles);
  }
  return map;
}

export function buildRoleCoverageMap(
  enriched: EnrichedDiscoveryResult[],
  canonicalRoles: string[],
  desiredRoles: string[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const role of canonicalRoles) {
    map[role] = countUsableForRole(enriched, role, desiredRoles);
  }
  return map;
}

export function buildUsableRecallDiagnostics(input: {
  tavilyEnriched: EnrichedDiscoveryResult[];
  combinedEnriched: EnrichedDiscoveryResult[];
  desiredRoles: string[];
  locations: string[];
  canonicalRoles: string[];
  tavilyRawHits: number;
  serpApiRawHits: number;
  serpApiFallbackTriggered: boolean;
  serpApiFallbackReason: string | null;
  serpApiSupplementalQueries: number;
}): UsableRecallDiagnostics {
  const tavilyOnly = input.tavilyEnriched.filter((entry) => entry.sourceProvider !== "serpapi");
  const serpOnly = input.combinedEnriched.filter((entry) => entry.sourceProvider === "serpapi");
  const tavilyMetrics = evaluateUsefulRecall(tavilyOnly, input.desiredRoles, input.tavilyRawHits);
  const serpMetrics = evaluateUsefulRecall(serpOnly, input.desiredRoles, input.serpApiRawHits);
  const combinedMetrics = evaluateUsefulRecall(input.combinedEnriched, input.desiredRoles, input.tavilyRawHits + input.serpApiRawHits);

  return {
    TAVILY_RAW: input.tavilyRawHits,
    TAVILY_USABLE: tavilyMetrics.usableEmployerProspects,
    TAVILY_EMPLOYERS: tavilyMetrics.acceptedEmployerCompanies,
    TAVILY_CONCRETE_VACANCIES: tavilyMetrics.concreteVacancyPages,
    TAVILY_DESIRED_ROLE_MATCHES: tavilyMetrics.desiredRoleVacancyMatches,
    TAVILY_LOCATION_COVERAGE: buildLocationCoverageMap(tavilyOnly, input.locations, input.desiredRoles),
    TAVILY_ROLE_COVERAGE: buildRoleCoverageMap(tavilyOnly, input.canonicalRoles, input.desiredRoles),
    SERPAPI_RAW: input.serpApiRawHits,
    SERPAPI_USABLE: serpMetrics.usableEmployerProspects,
    SERPAPI_FALLBACK_TRIGGERED: input.serpApiFallbackTriggered,
    SERPAPI_FALLBACK_REASON: input.serpApiFallbackReason,
    SERPAPI_SUPPLEMENTAL_QUERIES: input.serpApiSupplementalQueries,
    // combined usable available via combinedMetrics if needed downstream
  };
}

export function buildSupplementalSerpQueryVariant(input: {
  location: string;
  role: string;
  sector: string;
}): DiscoveryQueryVariant {
  const { location, role, sector } = input;
  const negative =
    "-indeed -linkedin -jooble -glassdoor -werkenbij -monster -stepstone -nationalevacaturebank -jobbird";
  return {
    query: [role, "vacature", location, sector, "bedrijf", "inurl:vacatures OR inurl:careers OR inurl:jobs", negative]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    intent: "vacancy_detail",
    label: `SerpAPI supplemental ${role} ${location}`,
    location,
    role,
  };
}

export async function executeSupplementalSerpApiRetrieval(input: {
  gaps: RecallCoverageGap[];
  sector: string;
  desiredRoles: string[];
  maxResults: number;
  timeoutMs: number;
  maxSupplementalQueries: number;
  processHits: (hits: SearchResultItem[], providerId: string, variant: DiscoveryQueryVariant) => EnrichedDiscoveryResult[];
}): Promise<{
  enriched: EnrichedDiscoveryResult[];
  rawHits: number;
  queriesExecuted: number;
  reasons: string[];
}> {
  const enriched: EnrichedDiscoveryResult[] = [];
  let rawHits = 0;
  let queriesExecuted = 0;
  const reasons: string[] = [];

  for (const gap of input.gaps.slice(0, input.maxSupplementalQueries)) {
    const variant = buildSupplementalSerpQueryVariant({
      location: gap.location,
      role: gap.role,
      sector: input.sector,
    });

    const execution = await executeSerpApiDiscoveryQuery({
      query: variant.query,
      maxResults: input.maxResults,
      timeoutMs: input.timeoutMs,
      processHits: (hits, providerId) => input.processHits(hits, providerId, variant),
    });

    queriesExecuted += 1;
    rawHits += execution.rawHitCount;
    enriched.push(...execution.enrichedResults);
    reasons.push(gap.reason);

    if (execution.error) {
      reasons.push(`SerpAPI supplemental mislukt (${gap.location}/${gap.role}): ${execution.error}`);
    }
  }

  return { enriched, rawHits, queriesExecuted, reasons };
}

export function resolveCanonicalRoles(desiredRoles: string[]): string[] {
  return primaryDesiredRoles(desiredRoles.length ? desiredRoles : ["recruiter", "accountmanager", "customer success manager"]);
}
