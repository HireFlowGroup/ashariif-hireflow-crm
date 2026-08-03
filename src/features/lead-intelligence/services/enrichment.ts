import type { ExternalCompanyCandidate, HiringSignal } from "@/features/lead-intelligence/domain";
import {
  HIRING_PAGE_KEYWORDS,
  RELEVANT_VACANCY_KEYWORDS,
} from "@/features/lead-intelligence/domain";
import { getLeadIntelligenceConfig, withRetry, withTimeout } from "@/features/lead-intelligence/config/providers.config";
import { extractDomain, normalizeEmail } from "@/features/lead-intelligence/services/normalize";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+31|0)[\s-]?(?:\d[\s-]?){8,}/g;

export async function enrichFromWebsite(
  candidate: ExternalCompanyCandidate,
): Promise<ExternalCompanyCandidate> {
  const config = getLeadIntelligenceConfig();
  const website = candidate.website;

  if (!website) {
    return candidate;
  }

  try {
    const html = await withRetry(() =>
      withTimeout(fetchWebsiteHtml(website), config.providerTimeoutMs, "Website crawl"),
    );

    const hiringSignals = detectHiringSignalsFromHtml(html, website);
    const vacancyTitles = extractVacancyTitles(html);
    const emails = extractEmails(html);
    const phones = extractPhones(html);

    return {
      ...candidate,
      domain: candidate.domain ?? extractDomain(website),
      email: candidate.email ?? emails[0] ?? null,
      phone: candidate.phone ?? phones[0] ?? null,
      vacancyCount: Math.max(candidate.vacancyCount, vacancyTitles.length),
      vacancyTitles: [...new Set([...candidate.vacancyTitles, ...vacancyTitles])],
      hiringSignals: [...candidate.hiringSignals, ...hiringSignals],
      lastVerifiedAt: new Date().toISOString(),
      confidence: Math.min(1, candidate.confidence + 0.1),
    };
  } catch {
    return candidate;
  }
}

async function fetchWebsiteHtml(url: string): Promise<string> {
  const response = await fetch(url.startsWith("http") ? url : `https://${url}`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "HireFlow-LeadIntelligence/1.0 (business research)",
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Website gaf status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/html")) {
    throw new Error("Geen HTML-pagina");
  }

  const text = await response.text();
  return text.slice(0, 500_000);
}

export function detectHiringSignalsFromHtml(html: string, sourceUrl: string): HiringSignal[] {
  const signals: HiringSignal[] = [];
  const lower = html.toLowerCase();

  for (const keyword of HIRING_PAGE_KEYWORDS) {
    if (lower.includes(keyword)) {
      signals.push({
        type: "hiring_page_keyword",
        description: `Vacaturepagina-indicator: "${keyword}"`,
        source: sourceUrl,
        confidence: 0.7,
      });
      break;
    }
  }

  const relevantMatches = RELEVANT_VACANCY_KEYWORDS.filter((keyword) =>
    lower.includes(keyword),
  );

  for (const match of relevantMatches.slice(0, 5)) {
    signals.push({
      type: "relevant_vacancy_keyword",
      description: `Relevante functie gevonden: "${match}"`,
      source: sourceUrl,
      confidence: 0.75,
    });
  }

  return signals;
}

export function extractVacancyTitles(html: string): string[] {
  const titles: string[] = [];
  const lower = html.toLowerCase();

  for (const keyword of RELEVANT_VACANCY_KEYWORDS) {
    if (lower.includes(keyword)) {
      titles.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
    }
  }

  return titles;
}

function extractEmails(html: string): string[] {
  const matches = html.match(EMAIL_REGEX) ?? [];
  return [...new Set(matches.map(normalizeEmail).filter(Boolean) as string[])].slice(0, 3);
}

function extractPhones(html: string): string[] {
  const matches = html.match(PHONE_REGEX) ?? [];
  return [...new Set(matches.map((phone) => phone.trim()))].slice(0, 2);
}

export function verifyWebsiteBelongsToCompany(
  candidate: ExternalCompanyCandidate,
  html: string,
): boolean {
  const normalizedName = candidate.normalizedName.replace(/\s/g, "");
  const lower = html.toLowerCase();
  const nameParts = candidate.name.toLowerCase().split(/\s+/).filter((part) => part.length > 3);

  if (nameParts.some((part) => lower.includes(part))) {
    return true;
  }

  if (normalizedName.length > 4 && lower.replace(/\s/g, "").includes(normalizedName.slice(0, 6))) {
    return true;
  }

  return Boolean(candidate.domain && html.includes(candidate.domain));
}
