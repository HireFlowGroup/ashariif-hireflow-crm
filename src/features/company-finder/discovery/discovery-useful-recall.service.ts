import { isVacancyBoardDomain } from "@/features/company-finder/discovery/discovery-domain-blocklist";
import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";

export type UsefulRecallMetrics = {
  rawResults: number;
  uniqueUrls: number;
  uniqueEmployerDomains: number;
  employerHostedResults: number;
  concreteVacancyPages: number;
  desiredRoleVacancyMatches: number;
  acceptedEmployerCompanies: number;
  /** Accepted employers with concrete vacancy URL or desired-role match — pre-validation gate. */
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

function matchesDesiredRole(title: string | null | undefined, desiredRoles: string[]): boolean {
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
): UsefulRecallMetrics {
  const uniqueUrls = new Set(enriched.map((entry) => canonicalUrl(entry.url)).filter(Boolean)).size;
  const employerHosted = enriched.filter(isEmployerHostedDiscoveryResult);
  const uniqueEmployerDomains = new Set(
    employerHosted.map((entry) => entry.officialDomain?.toLowerCase()).filter(Boolean),
  ).size;
  const concreteVacancyPages = enriched.filter(isConcreteVacancyDiscoveryResult).length;
  const desiredRoleVacancyMatches = enriched.filter(
    (entry) => isConcreteVacancyDiscoveryResult(entry)
      && matchesDesiredRole(entry.vacancyTitle ?? entry.title, desiredRoles),
  ).length;
  const acceptedEmployerCompanies = new Set(
    employerHosted.map((entry) => entry.officialDomain?.toLowerCase()).filter(Boolean),
  ).size;

  const usableEmployerDomains = new Set<string>();
  for (const entry of enriched) {
    if (!entry.accepted || !entry.officialDomain) continue;
    const concrete = isConcreteVacancyDiscoveryResult(entry);
    const roleMatch = concrete && matchesDesiredRole(entry.vacancyTitle ?? entry.title, desiredRoles);
    if (roleMatch) {
      usableEmployerDomains.add(entry.officialDomain.toLowerCase());
    }
  }
  const usableEmployerProspects = usableEmployerDomains.size;

  const rawResults = enriched.length;
  const technicalSuccess = rawResults > 0;
  const usefulRecall = usableEmployerProspects > 0;

  return {
    rawResults,
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
  },
): SerpApiFallbackDecision {
  if (!input.serpApiAvailable) {
    return { trigger: false, reason: null };
  }

  if (input.tavilyFailed) {
    return {
      trigger: true,
      reason: "Tavily technisch mislukt of 0 resultaten — SerpAPI fallback",
    };
  }

  if (!metrics.technicalSuccess) {
    return {
      trigger: true,
      reason: "Tavily leverde geen verwerkbare resultaten — SerpAPI fallback",
    };
  }

  if (input.vacancyFocusedQuery && metrics.usableEmployerProspects === 0) {
    if (metrics.employerHostedResults === 0) {
      return {
        trigger: true,
        reason: `Tavily technisch succesvol (${metrics.rawResults} hits) maar 0 employer-hosted vacancy/careers signalen`,
      };
    }

    if (metrics.concreteVacancyPages === 0) {
      return {
        trigger: true,
        reason: `Tavily oppervlakkige recall (${metrics.rawResults} raw, ${metrics.employerHostedResults} employer-hosted) maar 0 concrete vacaturepagina's`,
      };
    }

    if (metrics.rawResults >= 3 && metrics.desiredRoleVacancyMatches === 0) {
      return {
        trigger: true,
        reason: `Tavily recall mist desired-role matches (${metrics.rawResults} raw, ${metrics.concreteVacancyPages} concrete, 0 rol-match)`,
      };
    }

    return {
      trigger: true,
      reason: `Tavily produceert geen bruikbare employer prospects (${metrics.usableEmployerProspects} usable van ${metrics.acceptedEmployerCompanies} accepted)`,
    };
  }

  return { trigger: false, reason: null };
}
