import { braveSearch } from "@/features/lead-intelligence/clients/brave-search.client";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";
import { withTimeout, getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";
import { HIRING_PAGE_KEYWORDS, RELEVANT_VACANCY_KEYWORDS } from "@/features/lead-intelligence/domain";
import { linkedInResultToCandidate } from "@/features/lead-intelligence/providers/discovery/brave-candidate-mapper";
import {
  classifyGeneralEmail,
  classifyHrEmail,
  extractEmailsFromText,
  extractKvkFromText,
  extractPhonesFromText,
  findCareersUrl,
  mergeEnrichment,
} from "@/features/lead-intelligence/services/recruitment-normalize";
import { extractDomain } from "@/features/lead-intelligence/services/normalize";
import {
  detectHiringSignalsFromHtml,
  extractVacancyTitles,
} from "@/features/lead-intelligence/services/enrichment";
import { logPipelinePhase } from "@/lib/company-finder/pipeline-logger";

type EnrichmentContext = {
  jobId?: string;
  company?: string;
};

async function runOptionalStep<T>(
  phase: "ENRICHMENT",
  provider: string,
  company: string,
  jobId: string | undefined,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  const started = Date.now();
  logPipelinePhase({ phase, provider, company, status: "started", jobId });

  try {
    const value = await fn();
    logPipelinePhase({
      phase,
      provider,
      company,
      status: "completed",
      durationMs: Date.now() - started,
      jobId,
    });
    return value;
  } catch (error) {
    logPipelinePhase({
      phase,
      provider,
      company,
      status: "failed",
      durationMs: Date.now() - started,
      error,
      jobId,
    });
    return fallback;
  }
}

/**
 * Recruitment enrichment pipeline per company.
 * Each provider step is optional — failures never throw to the caller.
 */
export async function enrichRecruitmentCandidate(
  candidate: ExternalCompanyCandidate,
  criteria: { city?: string; region?: string; sector?: string },
  context: EnrichmentContext = {},
): Promise<ExternalCompanyCandidate> {
  const config = getLeadIntelligenceConfig();
  const company = context.company ?? candidate.name;
  let enriched = { ...candidate };

  if (!enriched.website && enriched.name) {
    enriched = await runOptionalStep(
      "ENRICHMENT",
      "brave-search",
      company,
      context.jobId,
      () =>
        withTimeout(
          discoverCompanyWebsite(enriched, criteria),
          config.crawlerTimeoutMs,
          `Website discovery ${company}`,
        ),
      enriched,
    );
  }

  if (enriched.website) {
    enriched = await runOptionalStep(
      "ENRICHMENT",
      "firecrawl",
      company,
      context.jobId,
      () =>
        withTimeout(
          enrichFromFirecrawl(enriched),
          config.crawlerTimeoutMs,
          `Crawl ${company}`,
        ),
      enriched,
    );
  }

  if (!enriched.linkedinUrl) {
    enriched = await runOptionalStep(
      "ENRICHMENT",
      "brave-linkedin",
      company,
      context.jobId,
      () =>
        withTimeout(
          discoverLinkedInProfile(enriched, criteria),
          config.tavilyTimeoutMs,
          `LinkedIn discovery ${company}`,
        ),
      enriched,
    );
  }

  if (criteria.sector && !enriched.sector) {
    enriched = { ...enriched, sector: criteria.sector };
  }

  enriched = {
    ...enriched,
    lastVerifiedAt: new Date().toISOString(),
  };

  pipelineDebug("enrichment.completed", {
    name: enriched.name,
    website: enriched.website,
    linkedinUrl: enriched.linkedinUrl,
    generalEmail: enriched.generalEmail,
    hrEmail: enriched.hrEmail,
    vacancyCount: enriched.vacancyCount,
  });

  return enriched;
}

async function discoverCompanyWebsite(
  candidate: ExternalCompanyCandidate,
  criteria: { city?: string; region?: string },
): Promise<ExternalCompanyCandidate> {
  const query = [candidate.name, criteria.city, criteria.region, "officiële website"].filter(Boolean).join(" ");
  const results = await braveSearch(query, 5);

  const match = results.find(
    (result) =>
      result.url.startsWith("http") &&
      !result.url.includes("linkedin.com") &&
      !result.url.includes("indeed.nl") &&
      !result.url.includes("facebook.com"),
  );

  if (!match) {
    return candidate;
  }

  return {
    ...candidate,
    website: match.url,
    domain: extractDomain(match.url),
  };
}

async function enrichFromFirecrawl(
  candidate: ExternalCompanyCandidate,
): Promise<ExternalCompanyCandidate> {
  const url = candidate.website!;

  const chain = await getProviderManager().executeCrawlChain(url);
  return applyScrapedContent(candidate, chain.result.html, chain.result.markdown, url);
}

function applyScrapedContent(
  candidate: ExternalCompanyCandidate,
  html: string,
  text: string,
  baseUrl: string,
): ExternalCompanyCandidate {
  const emails = extractEmailsFromText(text);
  const phones = extractPhonesFromText(text);
  const hrEmail = classifyHrEmail(emails);
  const generalEmail = classifyGeneralEmail(emails) ?? emails[0] ?? null;
  const careersUrl = findCareersUrl(html, baseUrl) ?? candidate.careersUrl;
  const vacancyTitles = extractVacancyTitles(html);
  const hiringSignals = detectHiringSignalsFromHtml(html, baseUrl);
  const kvkNumber = extractKvkFromText(text);

  const vacancyPageUrl =
    careersUrl ??
    (HIRING_PAGE_KEYWORDS.some((keyword) => baseUrl.toLowerCase().includes(keyword)) ? baseUrl : null);

  const relevantVacancies = RELEVANT_VACANCY_KEYWORDS.filter((keyword) =>
    text.toLowerCase().includes(keyword),
  );

  return mergeEnrichment(candidate, {
    domain: candidate.domain ?? extractDomain(baseUrl),
    generalEmail,
    hrEmail,
    email: generalEmail ?? hrEmail ?? candidate.email,
    phone: phones[0] ?? candidate.phone,
    careersUrl,
    vacancyPageUrl,
    kvkNumber,
    vacancyCount: Math.max(candidate.vacancyCount, vacancyTitles.length, relevantVacancies.length > 0 ? 1 : 0),
    vacancyTitles: [...new Set([...candidate.vacancyTitles, ...vacancyTitles])],
    hiringSignals: [...candidate.hiringSignals, ...hiringSignals],
    confidence: Math.min(1, candidate.confidence + 0.15),
  });
}

async function discoverLinkedInProfile(
  candidate: ExternalCompanyCandidate,
  criteria: { city?: string; sector?: string },
): Promise<ExternalCompanyCandidate> {
  const query = [candidate.name, criteria.city, criteria.sector, "site:linkedin.com/company"].filter(Boolean).join(" ");
  const results = await braveSearch(query, 5);

  for (const result of results) {
    const linkedInCandidate = linkedInResultToCandidate(result, {
      city: criteria.city,
      region: candidate.region ?? undefined,
      sector: criteria.sector,
    });

    if (linkedInCandidate?.linkedinUrl) {
      return {
        ...candidate,
        linkedinUrl: linkedInCandidate.linkedinUrl,
        description: candidate.description ?? linkedInCandidate.description,
        confidence: Math.min(1, candidate.confidence + 0.1),
      };
    }
  }

  return candidate;
}
