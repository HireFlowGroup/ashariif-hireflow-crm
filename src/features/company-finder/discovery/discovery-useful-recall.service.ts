import { isVacancyBoardDomain } from "@/features/company-finder/discovery/discovery-domain-blocklist";
import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";

export type UsefulRecallMetrics = {
  /** Raw hits returned by the search provider API. */
  rawHitCount: number;
  /** Enriched/classified result rows after processing. */
  processedResults: number;
  /** @deprecated Use rawHitCount */
  rawResults: number;
  uniqueUrls: number;
  uniqueEmployerDomains: number;
  employerHostedResults: number;
  concreteVacancyPages: number;
  desiredRoleVacancyMatches: number;
  acceptedEmployerCompanies: number;
  /** Unique accepted domains with concrete vacancy + desired-role match. */
  usableEmployerProspects: number;
  technicalSuccess: boolean;
  usefulRecall: boolean;
};

export type SerpApiFallbackDecision = {
  trigger: boolean;
  reason: string | null;
};

const ROLE_PATTERNS: Record<string, RegExp[]> = {
  recruiter: [/\brecruiter\b/i, /\btalent acquisition\b/i, /\brecruitment\b/i],
  accountmanager: [/\baccount\s?manager\b/i, /\baccountmanager\b/i],
  "customer success manager": [/\bcustomer success\b/i, /\bcsm\b/i, /\bclient success\b/i],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function matchesDesiredRoleTitle(title: string | null | undefined, desiredRoles: string[]): boolean {
  if (!title?.trim() || desiredRoles.length === 0) return false;
  const normalizedTitle = normalize(title);
  const normalizedDesired = desiredRoles.map(normalize);

  for (const desired of normalizedDesired) {
    if (desired.includes("recruit") && ROLE_PATTERNS.recruiter.some((p) => p.test(normalizedTitle))) return true;
    if (desired.includes("account") && ROLE_PATTERNS.accountmanager.some((p) => p.test(normalizedTitle))) return true;
    if ((desired.includes("customer") || desired.includes("csm"))
      && ROLE_PATTERNS["customer success manager"].some((p) => p.test(normalizedTitle))) {
      return true;
    }
  }
  return false;
}

function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

export function isEmployerHostedDiscoveryResult(result: EnrichedDiscoveryResult): boolean {
  if (!result.accepted || !result.officialDomain) return false;
  if (isVacancyBoardDomain(result.url)) return false;
  if (result.resultType === "individual_vacancy") return true;
  if (result.resultType === "company_careers_page") return true;
  if (result.resultType === "official_company_site") return true;
  return false;
}

export function isConcreteVacancyDiscoveryResult(result: EnrichedDiscoveryResult): boolean {
  if (!isEmployerHostedDiscoveryResult(result)) return false;
  if (result.resultType === "individual_vacancy") {
    return hasConcreteJobUrl(result.vacancyUrl ?? result.url);
  }
  if (result.vacancyTitle && hasConcreteJobUrl(result.vacancyUrl ?? result.url)) return true;
  return false;
}

/** Evaluate whether processed provider hits contain employer-hosted vacancy recall. */
export function evaluateUsefulRecall(
  enriched: EnrichedDiscoveryResult[],
  desiredRoles: string[],
  rawHitCount = enriched.length,
): UsefulRecallMetrics {
  const uniqueUrls = new Set(enriched.map((entry) => canonicalUrl(entry.url)).filter(Boolean)).size;
  const employerHosted = enriched.filter(isEmployerHostedDiscoveryResult);
  const uniqueEmployerDomains = new Set(
    employerHosted.map((entry) => entry.officialDomain?.toLowerCase()).filter(Boolean),
  ).size;
  const concreteVacancyPages = enriched.filter(isConcreteVacancyDiscoveryResult).length;
  const desiredRoleVacancyMatches = enriched.filter(
    (entry) => isConcreteVacancyDiscoveryResult(entry)
      && matchesDesiredRoleTitle(entry.vacancyTitle ?? entry.title, desiredRoles),
  ).length;
  const acceptedEmployerCompanies = new Set(
    employerHosted.map((entry) => entry.officialDomain?.toLowerCase()).filter(Boolean),
  ).size;

  const usableEmployerDomains = new Set<string>();
  for (const entry of enriched) {
    if (!entry.accepted || !entry.officialDomain) continue;
    const concrete = isConcreteVacancyDiscoveryResult(entry);
    const roleMatch = concrete && matchesDesiredRoleTitle(entry.vacancyTitle ?? entry.title, desiredRoles);
    if (roleMatch) {
      usableEmployerDomains.add(entry.officialDomain.toLowerCase());
    }
  }
  const usableEmployerProspects = usableEmployerDomains.size;

  const processedResults = enriched.length;
  const technicalSuccess = rawHitCount > 0;
  const usefulRecall = usableEmployerProspects > 0;

  return {
    rawHitCount,
    processedResults,
    rawResults: rawHitCount,
    uniqueUrls,
    uniqueEmployerDomains,
    employerHostedResults: employerHosted.length,
    concreteVacancyPages,
    desiredRoleVacancyMatches,
    acceptedEmployerCompanies,
    usableEmployerProspects,
    technicalSuccess,
    usefulRecall,
  };
}

/**
 * SerpAPI fallback uses pre-validation usable recall metrics:
 * - concreteVacancyPages: employer-hosted URLs passing hasConcreteJobUrl
 * - desiredRoleVacancyMatches: concrete vacancies matching desired roles
 * - usableEmployerProspects: unique accepted domains with concrete vacancy OR role match
 * - acceptedEmployerCompanies: unique accepted employer-hosted domains (broader)
 *
 * Fallback triggers when Tavily is technically OK but produces insufficient usable evidence.
 */
export function shouldTriggerSerpApiFallback(
  metrics: UsefulRecallMetrics,
  input: {
    serpApiAvailable: boolean;
    tavilyFailed: boolean;
    vacancyFocusedQuery: boolean;
    /** When true, usable recall is already sufficient — skip fallback. */
    skipWhenUsable?: boolean;
  },
): SerpApiFallbackDecision {
  if (!input.serpApiAvailable) {
    return { trigger: false, reason: null };
  }

  if (input.skipWhenUsable && metrics.usefulRecall) {
    return { trigger: false, reason: null };
  }

  if (input.tavilyFailed) {
    return {
      trigger: true,
      reason: "Tavily technisch mislukt of 0 API-resultaten — SerpAPI fallback",
    };
  }

  if (!input.vacancyFocusedQuery) {
    return { trigger: false, reason: null };
  }

  if (metrics.rawHitCount === 0) {
    return {
      trigger: true,
      reason: "Tavily leverde 0 raw hits — SerpAPI fallback",
    };
  }

  if (metrics.usableEmployerProspects > 0) {
    return { trigger: false, reason: null };
  }

  if (metrics.concreteVacancyPages === 0) {
    return {
      trigger: true,
      reason: `Tavily ${metrics.rawHitCount} raw hits maar 0 concrete employer-hosted vacature-URL's`,
    };
  }

  if (metrics.desiredRoleVacancyMatches === 0) {
    return {
      trigger: true,
      reason: `Tavily ${metrics.rawHitCount} raw, ${metrics.concreteVacancyPages} concrete, 0 desired-role matches`,
    };
  }

  return {
    trigger: true,
    reason: `Tavily ${metrics.rawHitCount} raw maar 0 usable downstream prospects (${metrics.acceptedEmployerCompanies} employers)`,
  };
}
