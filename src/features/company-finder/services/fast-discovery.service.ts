import "server-only";

import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import type { TavilyDiscoveryResult } from "@/features/company-finder/discovery/discovery-quality-gate";
import { classifyDiscoveryResult } from "@/features/company-finder/discovery/result-classifier.service";
import { validateOfficialDomain } from "@/features/company-finder/discovery/official-domain.service";
import type {
  DiscoveryFunnelMetrics,
  DiscoveryRejectionReasonCode,
  DiscoveryResultLogEntry,
  DiscoveryResultType,
  EnrichedDiscoveryResult,
} from "@/features/company-finder/discovery/discovery-result.types";
import {
  buildVacancyDrivenDiscoveryQueries,
  selectDiscoveryQueries,
  type DiscoveryQueryVariant,
} from "@/features/ai-recruiter/services/discovery-query-builder.service";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import { withTimeout } from "@/features/lead-intelligence/config/providers.config";
import { runWithConcurrencySettled } from "@/lib/async/run-with-concurrency-settled";

export type DiscoveryQueryDiagnostic = {
  query: string;
  intent: DiscoveryQueryVariant["intent"];
  label: string;
  rawResultCount: number;
  companyResults: number;
  vacancyResults: number;
  directoryResults: number;
  rejectedResults: number;
  durationMs: number;
  error: string | null;
};

export type MultiQueryDiscoveryResult = {
  results: TavilyDiscoveryResult[];
  enrichedResults: EnrichedDiscoveryResult[];
  resultLogs: DiscoveryResultLogEntry[];
  funnel: DiscoveryFunnelMetrics;
  providerId: string;
  queries: DiscoveryQueryDiagnostic[];
  totalRawResults: number;
  classifiedCounts: Record<DiscoveryResultType | "accepted" | "rejected", number>;
};

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

function dedupeEnriched(results: EnrichedDiscoveryResult[]): EnrichedDiscoveryResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = canonicalUrl(result.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapRejectionReason(
  classified: ReturnType<typeof classifyDiscoveryResult>,
): DiscoveryRejectionReasonCode | null {
  if (classified.shouldSaveAsCompany) return null;
  if (classified.excludedCompetitor) return "competitor";
  if (classified.resultType === "individual_vacancy" && !classified.employerName) return "unresolved_employer";
  if (classified.resultType === "individual_vacancy") return "vacancy_title_only";
  if (classified.resultType === "list_article") return "list_article";
  if (classified.resultType === "business_directory" || classified.resultType === "vacancy_board") return "directory";
  if (classified.resultType === "news_article") return "not_a_company";
  if (classified.resultType === "search_result_page") return "invalid_source";
  if (classified.resultType === "recruitment_agency") return "competitor";
  if (classified.resultType === "unknown") return "insufficient_evidence";
  if (classified.shouldSaveAsCompany === false && classified.resultType === "company_careers_page") {
    return "no_official_domain";
  }
  return "not_a_company";
}

function processRawResult(input: {
  title: string;
  url: string;
  description?: string | null;
  query: string;
  providerId: string;
  excludeRecruitmentAgencies: boolean;
}): EnrichedDiscoveryResult {
  const classified = classifyDiscoveryResult({
    title: input.title,
    url: input.url,
    description: input.description,
    excludeRecruitmentAgencies: input.excludeRecruitmentAgencies,
  });

  const employerName = classified.employerName;
  let officialDomain = classified.officialDomain;
  let domainConfidence = classified.domainConfidence;
  let domainSource = classified.domainSource;
  let accepted = classified.shouldSaveAsCompany;
  let rejectionReason = mapRejectionReason(classified);

  if (
    classified.resultType === "individual_vacancy"
    && classified.employerName
    && !classified.excludedCompetitor
  ) {
    const domainCheck = validateOfficialDomain({
      companyName: classified.employerName,
      url: input.url,
      title: input.title,
    });
    if (domainCheck.officialDomain) {
      officialDomain = domainCheck.officialDomain;
      domainConfidence = domainCheck.domainConfidence;
      domainSource = domainCheck.domainSource;
    }
    accepted = true;
    rejectionReason = officialDomain ? null : "no_official_domain";
    if (!officialDomain) accepted = false;
  }

  if (classified.resultType === "official_company_site" || classified.resultType === "company_careers_page") {
    const name = employerName ?? input.title;
    const domainCheck = validateOfficialDomain({ companyName: name, url: input.url, title: input.title });
    officialDomain = domainCheck.officialDomain ?? officialDomain;
    domainConfidence = domainCheck.domainConfidence;
    domainSource = domainCheck.domainSource;
    if (!officialDomain) {
      accepted = false;
      rejectionReason = "no_official_domain";
    }
  }

  if (classified.excludedCompetitor) {
    accepted = false;
    rejectionReason = "competitor";
  }

  return {
    title: input.title,
    url: input.url,
    description: input.description ?? null,
    query: input.query,
    resultType: classified.resultType,
    classificationConfidence: classified.classificationConfidence,
    classificationReason: classified.classificationReason,
    extractedCompanyName: employerName,
    extractedEmployer: employerName,
    officialDomain,
    domainConfidence,
    domainSource,
    vacancyTitle: classified.vacancyTitle,
    vacancyUrl: classified.vacancyTitle ? input.url : null,
    vacancySource: classified.vacancyTitle ? input.providerId : null,
    excludedCompetitor: classified.excludedCompetitor,
    accepted,
    rejectionReason,
  };
}

function toTavilyResult(enriched: EnrichedDiscoveryResult): TavilyDiscoveryResult | null {
  if (!enriched.accepted || !enriched.extractedCompanyName) return null;
  const website = enriched.officialDomain
    ? `https://${enriched.officialDomain}`
    : enriched.url;

  return {
    title: enriched.extractedCompanyName,
    url: website,
    description: enriched.description,
  };
}

function buildFunnel(
  logs: DiscoveryResultLogEntry[],
  queries: DiscoveryQueryDiagnostic[],
  saved: number,
): DiscoveryFunnelMetrics {
  const uniqueUrls = new Set(logs.map((l) => canonicalUrl(l.resultUrl))).size;
  return {
    queriesExecuted: queries.length,
    rawResults: logs.length,
    uniqueUrls,
    officialCompanySites: logs.filter((l) => l.classifiedType === "official_company_site").length,
    vacancyResults: logs.filter((l) =>
      l.classifiedType === "individual_vacancy" || l.classifiedType === "vacancy_board",
    ).length,
    directories: logs.filter((l) => l.classifiedType === "business_directory").length,
    listArticles: logs.filter((l) => l.classifiedType === "list_article").length,
    newsArticles: logs.filter((l) => l.classifiedType === "news_article").length,
    competitorsExcluded: logs.filter((l) => l.excludedCompetitor || l.rejectionReason === "competitor").length,
    realCompanies: logs.filter((l) => l.accepted).length,
    companiesInRegion: logs.filter((l) => l.accepted).length,
    companiesInSector: logs.filter((l) => l.accepted).length,
    withVacancyEvidence: logs.filter((l) => l.accepted && l.vacancyTitle).length,
    withoutVacancyEvidence: logs.filter((l) => l.accepted && !l.vacancyTitle).length,
    saved,
    rejected: logs.filter((l) => !l.accepted).length,
  };
}

export async function runFastTavilySearch(
  criteria: CompanySearchCriteria,
  options: {
    maxResults: number;
    timeoutMs: number;
    searchPlan?: import("@/features/ai-recruiter/domain/types").AiRecruiterSearchPlan;
  },
): Promise<MultiQueryDiscoveryResult> {
  const config = getAiRecruiterConfig();
  const queryVariants = selectDiscoveryQueries(
    buildVacancyDrivenDiscoveryQueries(criteria, options.searchPlan),
    options.searchPlan?.maximum_companies ?? options.maxResults,
  );

  const perQueryMax = config.resultsPerQuery;
  const globalMax = Math.max(options.maxResults, queryVariants.length * perQueryMax);

  let providerId = "tavily";
  const allEnriched: EnrichedDiscoveryResult[] = [];
  const resultLogs: DiscoveryResultLogEntry[] = [];
  const diagnostics: DiscoveryQueryDiagnostic[] = [];
  const classifiedCounts: MultiQueryDiscoveryResult["classifiedCounts"] = {
    official_company_site: 0,
    company_profile: 0,
    company_careers_page: 0,
    individual_vacancy: 0,
    vacancy_board: 0,
    business_directory: 0,
    list_article: 0,
    news_article: 0,
    search_result_page: 0,
    recruitment_agency: 0,
    unknown: 0,
    accepted: 0,
    rejected: 0,
  };

  const queryTasks = queryVariants.map((variant) => async () => {
    const started = Date.now();
    let rawResultCount = 0;
    let error: string | null = null;
    let companyResults = 0;
    let vacancyResults = 0;
    let directoryResults = 0;
    let rejectedResults = 0;

    try {
      const chain = await withTimeout(
        getProviderManager().executeSearchChain(variant.query, perQueryMax),
        options.timeoutMs,
        `Discovery query: ${variant.label}`,
      );

      providerId = chain.meta?.providerId ?? providerId;
      rawResultCount = chain.results.length;

      for (const result of chain.results) {
        const enriched = processRawResult({
          title: result.title,
          url: result.url,
          description: result.description ?? null,
          query: variant.query,
          providerId,
          excludeRecruitmentAgencies: config.excludeRecruitmentAgencies,
        });

        allEnriched.push(enriched);
        classifiedCounts[enriched.resultType] += 1;
        if (enriched.accepted) {
          classifiedCounts.accepted += 1;
          companyResults += 1;
        } else {
          classifiedCounts.rejected += 1;
          rejectedResults += 1;
          if (enriched.resultType === "individual_vacancy" || enriched.resultType === "vacancy_board") {
            vacancyResults += 1;
          }
          if (
            enriched.resultType === "business_directory"
            || enriched.resultType === "list_article"
            || enriched.resultType === "recruitment_agency"
          ) {
            directoryResults += 1;
          }
        }

        resultLogs.push({
          query: variant.query,
          provider: providerId,
          resultTitle: result.title,
          resultUrl: result.url,
          resultDomain: enriched.officialDomain ?? "",
          snippet: (result.description ?? "").slice(0, 300),
          classifiedType: enriched.resultType,
          classificationConfidence: enriched.classificationConfidence,
          classificationReason: enriched.classificationReason,
          extractedCompanyName: enriched.extractedCompanyName,
          extractedEmployer: enriched.extractedEmployer,
          officialDomain: enriched.officialDomain,
          domainConfidence: enriched.domainConfidence,
          domainSource: enriched.domainSource,
          vacancyTitle: enriched.vacancyTitle,
          vacancyUrl: enriched.vacancyUrl,
          excludedCompetitor: enriched.excludedCompetitor,
          accepted: enriched.accepted,
          rejectionReason: enriched.rejectionReason,
        });
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Query mislukt";
    }

    return {
      query: variant.query,
      intent: variant.intent,
      label: variant.label,
      rawResultCount,
      companyResults,
      vacancyResults,
      directoryResults,
      rejectedResults,
      durationMs: Date.now() - started,
      error,
    } satisfies DiscoveryQueryDiagnostic;
  });

  const settled = await runWithConcurrencySettled(queryTasks, config.discoveryConcurrency);
  for (const entry of settled) {
    if (entry.status === "fulfilled") diagnostics.push(entry.value);
    else {
      diagnostics.push({
        query: "unknown",
        intent: "company_discovery",
        label: "Query mislukt",
        rawResultCount: 0,
        companyResults: 0,
        vacancyResults: 0,
        directoryResults: 0,
        rejectedResults: 0,
        durationMs: 0,
        error: entry.reason instanceof Error ? entry.reason.message : "Query mislukt",
      });
    }
  }

  const deduped = dedupeEnriched(allEnriched);
  const seenCompanies = new Set<string>();
  const results: TavilyDiscoveryResult[] = [];

  for (const enriched of deduped) {
    if (!enriched.accepted) continue;
    const key = (enriched.officialDomain ?? enriched.extractedCompanyName ?? "").toLowerCase();
    if (key && seenCompanies.has(key)) {
      enriched.rejectionReason = "duplicate";
      enriched.accepted = false;
      continue;
    }
    if (key) seenCompanies.add(key);
    const tavily = toTavilyResult(enriched);
    if (tavily) results.push(tavily);
    if (results.length >= globalMax) break;
  }

  const funnel = buildFunnel(resultLogs, diagnostics, results.length);

  return {
    results: results.slice(0, globalMax),
    enrichedResults: deduped,
    resultLogs,
    funnel,
    providerId,
    queries: diagnostics,
    totalRawResults: diagnostics.reduce((sum, q) => sum + q.rawResultCount, 0),
    classifiedCounts,
  };
}

/** Backward-compatible export for callers expecting the old shape. */
export async function runFastTavilySearchLegacy(
  criteria: CompanySearchCriteria,
  options: { maxResults: number; timeoutMs: number },
): Promise<{ results: TavilyDiscoveryResult[]; providerId: string }> {
  const result = await runFastTavilySearch(criteria, options);
  return { results: result.results, providerId: result.providerId };
}
