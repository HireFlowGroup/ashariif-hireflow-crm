import "server-only";

import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import type { TavilyDiscoveryResult } from "@/features/company-finder/discovery/discovery-quality-gate";
import { evaluateDiscoveryEmployerForSave } from "@/features/company-finder/discovery/discovery-employer-criteria.service";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";
import { isGenericCompanyLabel } from "@/features/company-finder/discovery/generic-company-label";
import { brandNameFromDomain } from "@/features/company-finder/discovery/parse-website-identity";
import {
  classifyBusinessModel,
  isExcludedBusinessModel,
} from "@/features/company-finder/discovery/business-model-classifier.service";
import { classifyDiscoveryResult } from "@/features/company-finder/discovery/result-classifier.service";
import { validateOfficialDomain } from "@/features/company-finder/discovery/official-domain.service";
import type {
  DiscoveryFunnelMetrics,
  DiscoveryRejectionReasonCode,
  DiscoveryResultLogEntry,
  DiscoveryResultType,
  EnrichedDiscoveryResult,
} from "@/features/company-finder/discovery/discovery-result.types";
import { dedupeEnrichedDiscoveryResults } from "@/features/company-finder/discovery/discovery-result-dedupe.service";
import { executeQualityAwareDiscoveryQuery } from "@/features/company-finder/discovery/discovery-provider-runner.service";
import {
  buildUsableRecallDiagnostics,
  executeSupplementalSerpApiRetrieval,
  identifyRecallCoverageGaps,
  resolveCanonicalRoles,
} from "@/features/company-finder/discovery/discovery-run-fallback.service";
import type { UsableRecallDiagnostics } from "@/features/company-finder/discovery/discovery-usable-recall-diagnostics.types";
import {
  evaluateUsefulRecall,
  isConcreteVacancyDiscoveryResult,
  isEmployerHostedDiscoveryResult,
  matchesDesiredRoleTitle,
} from "@/features/company-finder/discovery/discovery-useful-recall.service";
import { getSerpApiKey } from "@/features/lead-intelligence/providers/manager/provider-env";
import {
  buildVacancyDrivenDiscoveryQueries,
  selectDiscoveryQueries,
  type DiscoveryQueryVariant,
} from "@/features/ai-recruiter/services/discovery-query-builder.service";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import { runWithConcurrencySettled } from "@/lib/async/run-with-concurrency-settled";
import type { SearchResultItem } from "@/features/lead-intelligence/providers/manager/types";

export type DiscoveryQueryDiagnostic = {
  query: string;
  intent: DiscoveryQueryVariant["intent"];
  label: string;
  location: string;
  role: string;
  rawResultCount: number;
  uniqueResultCount: number;
  companyResults: number;
  vacancyResults: number;
  directoryResults: number;
  rejectedResults: number;
  employerHostedResults: number;
  concreteVacancyResults: number;
  desiredRoleVacancyResults: number;
  provider: string;
  providersUsed: string[];
  tavilyUsefulRecall: boolean;
  serpApiFallbackTriggered: boolean;
  serpApiFallbackReason: string | null;
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
  queriesGenerated: string[];
  totalRawResults: number;
  classifiedCounts: Record<DiscoveryResultType | "accepted" | "rejected", number>;
  serpApiFallbackTriggered: boolean;
  serpApiFallbackReason: string | null;
  tavilyUsefulRecall: boolean;
  usableRecallDiagnostics: UsableRecallDiagnostics;
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
  discoveryLocation?: string | null;
  discoveryRole?: string | null;
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

  let resolvedName = employerName;
  if (resolvedName && isGenericCompanyLabel(resolvedName) && officialDomain) {
    resolvedName = brandNameFromDomain(officialDomain);
  }
  if (resolvedName && isGenericCompanyLabel(resolvedName)) {
    accepted = false;
    rejectionReason = "not_a_company";
  }

  if (accepted && !officialDomain) {
    accepted = false;
    rejectionReason = "no_official_domain";
  }

  if (accepted && isGenericCompanyLabel(input.title) && !resolvedName) {
    accepted = false;
    rejectionReason = "not_a_company";
  }

  const businessModel = classifyBusinessModel({
    name: resolvedName ?? input.title,
    url: input.url,
    description: input.description,
    excludeRecruitmentAgencies: input.excludeRecruitmentAgencies,
  });
  if (isExcludedBusinessModel(businessModel.classification, input.excludeRecruitmentAgencies)) {
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
    extractedCompanyName: resolvedName,
    extractedEmployer: resolvedName,
    officialDomain,
    domainConfidence,
    domainSource,
    vacancyTitle: classified.vacancyTitle,
    vacancyUrl: classified.vacancyTitle ? input.url : null,
    vacancySource: classified.vacancyTitle ? input.providerId : null,
    excludedCompetitor: classified.excludedCompetitor,
    accepted,
    rejectionReason,
    discoveryLocation: input.discoveryLocation ?? null,
    discoveryRole: input.discoveryRole ?? null,
    sourceProvider: input.providerId,
  };
}

function processHits(
  hits: SearchResultItem[],
  providerId: string,
  variant: DiscoveryQueryVariant,
  excludeRecruitmentAgencies: boolean,
): EnrichedDiscoveryResult[] {
  return hits.map((result) =>
    processRawResult({
      title: result.title,
      url: result.url,
      description: result.description ?? null,
      query: variant.query,
      providerId,
      excludeRecruitmentAgencies,
      discoveryLocation: variant.location,
      discoveryRole: variant.role,
    }),
  );
}

function extractLocationFromQuery(query: string, locations: string[]): string | null {
  const normalizedQuery = query.toLowerCase();
  for (const location of locations) {
    if (normalizedQuery.includes(location.toLowerCase())) return location;
  }
  return null;
}

function pickBestEnrichedPerDomain(enriched: EnrichedDiscoveryResult[]): EnrichedDiscoveryResult[] {
  const byDomain = new Map<string, EnrichedDiscoveryResult>();

  for (const entry of enriched) {
    if (!entry.accepted || !entry.officialDomain) continue;
    const key = entry.officialDomain.toLowerCase();
    const existing = byDomain.get(key);
    if (!existing) {
      byDomain.set(key, entry);
      continue;
    }

    const existingConcrete = isConcreteVacancyDiscoveryResult(existing);
    const entryConcrete = isConcreteVacancyDiscoveryResult(entry);
    if (entryConcrete && !existingConcrete) {
      byDomain.set(key, entry);
      continue;
    }

    if (entryConcrete && existingConcrete && entry.vacancyTitle && !existing.vacancyTitle) {
      byDomain.set(key, entry);
    }
  }

  return [...byDomain.values()];
}

function toTavilyResult(
  enriched: EnrichedDiscoveryResult,
  desiredRoles: string[],
  locations: string[],
  excludeRecruitmentAgencies: boolean,
  planLocations: string[],
): TavilyDiscoveryResult | null {
  if (!enriched.accepted || !enriched.extractedCompanyName || !enriched.officialDomain) return null;
  if (isGenericCompanyLabel(enriched.extractedCompanyName)) return null;

  const employerGate = evaluateDiscoveryEmployerForSave({
    name: enriched.extractedCompanyName,
    domain: enriched.officialDomain,
    url: enriched.url,
    resultType: enriched.resultType,
    excludeRecruitmentAgencies,
    plan: {
      sectors: [],
      desired_roles: desiredRoles,
      reasoning: "",
    },
  });
  if (!employerGate.acceptable) {
    enriched.accepted = false;
    enriched.rejectionReason = employerGate.reason === "recruitment_agency_excluded"
      ? "competitor"
      : employerGate.reason === "directory"
        ? "directory"
        : "not_a_company";
    return null;
  }

  const website = enriched.officialDomain
    ? `https://${enriched.officialDomain}`
    : enriched.url;
  const concreteVacancyUrl = enriched.vacancyUrl && hasConcreteJobUrl(enriched.vacancyUrl)
    ? enriched.vacancyUrl
    : enriched.resultType === "individual_vacancy" && hasConcreteJobUrl(enriched.url)
      ? enriched.url
      : null;

  return {
    title: enriched.extractedCompanyName,
    url: website,
    description: enriched.description,
    discoveryVacancyUrl: concreteVacancyUrl,
    discoveryVacancyTitle: enriched.vacancyTitle,
    discoveryVacancySource: enriched.vacancySource,
    discoveryLocation: extractLocationFromQuery(enriched.query, planLocations.length ? planLocations : locations),
    discoveryResultType: enriched.resultType,
    discoveryDesiredRoleMatch: matchesDesiredRoleTitle(enriched.vacancyTitle, desiredRoles),
  };
}

function buildFunnel(
  logs: DiscoveryResultLogEntry[],
  queries: DiscoveryQueryDiagnostic[],
  companiesPassedToGate: number,
  providerSummary: {
    serpApiFallbackTriggered: boolean;
    serpApiFallbackReason: string | null;
    tavilyUsefulRecall: boolean;
    queriesGenerated: string[];
    usableRecallDiagnostics?: UsableRecallDiagnostics;
  },
): DiscoveryFunnelMetrics {
  const uniqueUrls = new Set(logs.map((l) => canonicalUrl(l.resultUrl))).size;
  const withDiscoveryVacancyTitle = logs.filter((l) => l.accepted && l.vacancyTitle).length;
  const employerHostedResults = logs.filter((l) =>
    l.accepted
    && (l.classifiedType === "individual_vacancy"
      || l.classifiedType === "company_careers_page"
      || l.classifiedType === "official_company_site"),
  ).length;

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
    withDiscoveryVacancyTitle,
    withoutVacancyEvidence: logs.filter((l) => l.accepted && !l.vacancyTitle).length,
    companiesPassedToGate,
    saved: companiesPassedToGate,
    withVacancyEvidence: withDiscoveryVacancyTitle,
    rejected: logs.filter((l) => !l.accepted).length,
    employerHostedResults,
    concreteVacancyResults: logs.filter((l) => l.accepted && l.classifiedType === "individual_vacancy").length,
    desiredRoleVacancyResults: queries.reduce((sum, q) => sum + q.desiredRoleVacancyResults, 0),
    tavilyUsefulRecall: providerSummary.tavilyUsefulRecall,
    serpApiFallbackTriggered: providerSummary.serpApiFallbackTriggered,
    serpApiFallbackReason: providerSummary.serpApiFallbackReason,
    queriesGenerated: providerSummary.queriesGenerated,
    usableRecallDiagnostics: providerSummary.usableRecallDiagnostics,
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
  const queriesGenerated = queryVariants.map((variant) => variant.query);
  const desiredRoles = options.searchPlan?.desired_roles
    ?? criteria.desiredRoles
    ?? criteria.vacancyTitles
    ?? [];

  const perQueryMax = config.resultsPerQuery;
  const globalMax = Math.max(options.maxResults, queryVariants.length * perQueryMax);

  let providerId = "tavily";
  const allEnriched: EnrichedDiscoveryResult[] = [];
  const resultLogs: DiscoveryResultLogEntry[] = [];
  const diagnostics: DiscoveryQueryDiagnostic[] = [];
  let serpApiFallbackTriggered = false;
  let serpApiFallbackReason: string | null = null;
  let tavilyUsefulRecall = false;
  let tavilyRawHits = 0;
  let serpApiRawHits = 0;
  let serpApiSupplementalQueries = 0;
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
    let error: string | null = null;
    let rawResultCount = 0;
    let companyResults = 0;
    let vacancyResults = 0;
    let directoryResults = 0;
    let rejectedResults = 0;
    let employerHostedResults = 0;
    let concreteVacancyResults = 0;
    let queryProvider = "tavily";
    let providersUsed: string[] = ["tavily"];
    let queryTavilyUsefulRecall = false;
    let querySerpFallback = false;
    let querySerpFallbackReason: string | null = null;

    try {
      const execution = await executeQualityAwareDiscoveryQuery({
        query: variant.query,
        intent: variant.intent,
        maxResults: perQueryMax,
        timeoutMs: options.timeoutMs,
        desiredRoles,
        processHits: (hits, hitProviderId) =>
          processHits(hits, hitProviderId, variant, config.excludeRecruitmentAgencies),
      });

      providerId = execution.providerId;
      queryProvider = execution.providerId;
      providersUsed = execution.providersUsed;
      rawResultCount = execution.rawHitCount;
      tavilyRawHits += execution.tavilyRawHitCount;
      serpApiRawHits += execution.serpApiRawHitCount;
      queryTavilyUsefulRecall = execution.tavilyUsefulRecall;
      querySerpFallback = execution.serpApiFallbackTriggered;
      querySerpFallbackReason = execution.serpApiFallbackReason;

      if (execution.serpApiFallbackTriggered || execution.serpApiFallbackAttempted) {
        serpApiFallbackTriggered = true;
        serpApiFallbackReason = execution.serpApiFallbackReason;
      }
      if (execution.serpApiFallbackError && !error) {
        error = execution.serpApiFallbackError;
      }
      if (execution.tavilyUsefulRecall) {
        tavilyUsefulRecall = true;
      }

      for (const enriched of execution.enrichedResults) {
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

        if (isEmployerHostedDiscoveryResult(enriched)) employerHostedResults += 1;
        if (isConcreteVacancyDiscoveryResult(enriched)) concreteVacancyResults += 1;

        resultLogs.push({
          query: variant.query,
          provider: queryProvider,
          resultTitle: enriched.title,
          resultUrl: enriched.url,
          resultDomain: enriched.officialDomain ?? "",
          snippet: (enriched.description ?? "").slice(0, 300),
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

    const uniqueResultCount = new Set(
      allEnriched.filter((entry) => entry.query === variant.query).map((entry) => canonicalUrl(entry.url)),
    ).size;

    return {
      query: variant.query,
      intent: variant.intent,
      label: variant.label,
      location: variant.location,
      role: variant.role,
      rawResultCount,
      uniqueResultCount,
      companyResults,
      vacancyResults,
      directoryResults,
      rejectedResults,
      employerHostedResults,
      concreteVacancyResults,
      desiredRoleVacancyResults: evaluateUsefulRecall(
        allEnriched.filter((entry) => entry.query === variant.query),
        desiredRoles,
      ).desiredRoleVacancyMatches,
      provider: queryProvider,
      providersUsed,
      tavilyUsefulRecall: queryTavilyUsefulRecall,
      serpApiFallbackTriggered: querySerpFallback,
      serpApiFallbackReason: querySerpFallbackReason,
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
        intent: "role_specific",
        label: "Query mislukt",
        location: "",
        role: "",
        rawResultCount: 0,
        uniqueResultCount: 0,
        companyResults: 0,
        vacancyResults: 0,
        directoryResults: 0,
        rejectedResults: 0,
        employerHostedResults: 0,
        concreteVacancyResults: 0,
        desiredRoleVacancyResults: 0,
        provider: "tavily",
        providersUsed: [],
        tavilyUsefulRecall: false,
        serpApiFallbackTriggered: false,
        serpApiFallbackReason: null,
        durationMs: 0,
        error: entry.reason instanceof Error ? entry.reason.message : "Query mislukt",
      });
    }
  }

  const planLocations = options.searchPlan?.locations ?? criteria.locations ?? [];
  const searchLocations = planLocations.length
    ? planLocations
    : criteria.city
      ? [criteria.city]
      : [];
  const canonicalRoles = resolveCanonicalRoles(desiredRoles);
  const sector = options.searchPlan?.sectors?.[0] ?? criteria.sector ?? "";

  const coverageGaps = identifyRecallCoverageGaps({
    enriched: allEnriched,
    locations: searchLocations,
    canonicalRoles,
    desiredRoles,
  });

  if (coverageGaps.length > 0 && getSerpApiKey()) {
    const supplemental = await executeSupplementalSerpApiRetrieval({
      gaps: coverageGaps,
      sector,
      desiredRoles,
      maxResults: perQueryMax,
      timeoutMs: options.timeoutMs,
      maxSupplementalQueries: Math.min(coverageGaps.length, 6),
      processHits: (hits, hitProviderId, variant) =>
        processHits(hits, hitProviderId, variant, config.excludeRecruitmentAgencies),
    });

    if (supplemental.queriesExecuted > 0) {
      serpApiFallbackTriggered = true;
      serpApiSupplementalQueries = supplemental.queriesExecuted;
      serpApiRawHits += supplemental.rawHits;
      const supplementalReason = supplemental.reasons.join("; ");
      serpApiFallbackReason = serpApiFallbackReason
        ? `${serpApiFallbackReason}; ${supplementalReason}`
        : supplementalReason;

      for (const enriched of supplemental.enriched) {
        allEnriched.push(enriched);
        classifiedCounts[enriched.resultType] += 1;
        if (enriched.accepted) classifiedCounts.accepted += 1;
        else classifiedCounts.rejected += 1;

        resultLogs.push({
          query: enriched.query,
          provider: "serpapi",
          resultTitle: enriched.title,
          resultUrl: enriched.url,
          resultDomain: enriched.officialDomain ?? "",
          snippet: (enriched.description ?? "").slice(0, 300),
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
    }
  }

  const deduped = dedupeEnrichedDiscoveryResults(allEnriched);
  const domainBest = pickBestEnrichedPerDomain(deduped);
  const results: TavilyDiscoveryResult[] = [];

  for (const enriched of domainBest) {
    const tavily = toTavilyResult(
      enriched,
      desiredRoles,
      searchLocations,
      config.excludeRecruitmentAgencies,
      planLocations,
    );
    if (tavily) results.push(tavily);
    if (results.length >= globalMax) break;
  }

  const usableRecallDiagnostics = buildUsableRecallDiagnostics({
    tavilyEnriched: allEnriched.filter((entry) => entry.sourceProvider === "tavily"),
    combinedEnriched: deduped,
    desiredRoles,
    locations: searchLocations,
    canonicalRoles,
    tavilyRawHits,
    serpApiRawHits,
    serpApiFallbackTriggered,
    serpApiFallbackReason,
    serpApiSupplementalQueries,
  });

  const funnel = buildFunnel(resultLogs, diagnostics, results.length, {
    serpApiFallbackTriggered,
    serpApiFallbackReason,
    tavilyUsefulRecall,
    queriesGenerated,
    usableRecallDiagnostics,
  });

  return {
    results: results.slice(0, globalMax),
    enrichedResults: deduped,
    resultLogs,
    funnel,
    providerId,
    queries: diagnostics,
    queriesGenerated,
    totalRawResults: diagnostics.reduce((sum, q) => sum + q.rawResultCount, 0),
    classifiedCounts,
    serpApiFallbackTriggered,
    serpApiFallbackReason,
    tavilyUsefulRecall,
    usableRecallDiagnostics,
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
