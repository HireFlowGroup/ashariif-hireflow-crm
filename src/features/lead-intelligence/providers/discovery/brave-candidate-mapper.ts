import type { CompanySearchCriteria, ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import type { BraveSearchResult } from "@/features/lead-intelligence/clients/brave-search.client";
import { createEmptyCandidate } from "@/features/lead-intelligence/providers/types";
import {
  cleanCompanyTitle,
  extractDomain,
  normalizeCompanyName,
} from "@/features/lead-intelligence/services/recruitment-normalize";

export function buildDiscoveryQuery(
  criteria: CompanySearchCriteria,
  suffix = "",
): string {
  const vacancyPart = criteria.vacancyTitles?.join(" ");

  return [criteria.sector, criteria.keywords, vacancyPart, criteria.city, criteria.region, suffix]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function braveResultToCandidate(
  result: BraveSearchResult,
  source: string,
  criteria: CompanySearchCriteria,
  confidence: number,
): ExternalCompanyCandidate | null {
  const name = cleanCompanyTitle(result.title);

  if (!name || name.length < 2) {
    return null;
  }

  const website = result.url.startsWith("http") ? result.url : null;

  if (shouldSkipUrl(website)) {
    return null;
  }

  const domain = website ? extractDomain(website) : null;

  return createEmptyCandidate({
    externalId: `${source}:${domain ?? name.toLowerCase()}`,
    name,
    normalizedName: normalizeCompanyName(name),
    website,
    domain,
    city: criteria.city ?? null,
    region: criteria.region ?? null,
    province: criteria.region ?? null,
    sector: criteria.sector ?? null,
    description: result.description || null,
    source,
    sourceUrl: website,
    confidence,
  });
}

function shouldSkipUrl(url: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  const blocked = [
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "wikipedia.org",
    "linkedin.com/in/",
    "indeed.nl/viewjob",
    "glassdoor.",
  ];
  return blocked.some((host) => lower.includes(host));
}

export function linkedInResultToCandidate(
  result: BraveSearchResult,
  criteria: CompanySearchCriteria,
): ExternalCompanyCandidate | null {
  if (!result.url.includes("linkedin.com/company/")) {
    return null;
  }

  const name = cleanCompanyTitle(result.title.replace(/ \| LinkedIn.*$/i, ""));

  return createEmptyCandidate({
    externalId: `linkedin:${result.url}`,
    name,
    normalizedName: normalizeCompanyName(name),
    website: null,
    domain: null,
    linkedinUrl: result.url.split("?")[0] ?? result.url,
    city: criteria.city ?? null,
    region: criteria.region ?? null,
    province: criteria.region ?? null,
    sector: criteria.sector ?? null,
    description: result.description || null,
    source: "linkedin",
    sourceUrl: result.url,
    confidence: 0.7,
  });
}

export function vacancyResultToCandidate(
  result: BraveSearchResult,
  source: string,
  criteria: CompanySearchCriteria,
): ExternalCompanyCandidate | null {
  const name = extractCompanyFromVacancyTitle(result.title);

  if (!name) {
    return null;
  }

  return createEmptyCandidate({
    externalId: `${source}:${normalizeCompanyName(name)}`,
    name,
    normalizedName: normalizeCompanyName(name),
    website: null,
    domain: null,
    city: criteria.city ?? null,
    region: criteria.region ?? null,
    province: criteria.region ?? null,
    sector: criteria.sector ?? null,
    vacancyCount: 1,
    vacancyTitles: [result.title],
    description: result.description || null,
    source,
    sourceUrl: result.url,
    confidence: 0.6,
  });
}

function extractCompanyFromVacancyTitle(title: string): string | null {
  const atMatch = title.match(/(?:bij|at|@)\s+(.+?)(?:\s*[|\-–—]|$)/i);
  if (atMatch?.[1]) return cleanCompanyTitle(atMatch[1]);

  const cleaned = cleanCompanyTitle(title);
  return cleaned.length >= 2 ? cleaned : null;
}
