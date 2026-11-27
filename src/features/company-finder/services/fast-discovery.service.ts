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
import { ensureProviderRegistryBootstrapped } from "@/features/lead-intelligence/providers/manager/provider-registry";
import { getSerpApiKey } from "@/features/lead-intelligence/providers/manager/provider-env";
import {
  sanitizeDiscoveryProviderError,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";
import type { RunFailureCode } from "@/features/ai-recruiter/domain/run-diagnostics";
import {
  buildVacancyDrivenDiscoveryQueries,
  selectDiscoveryQueries,
  type DiscoveryQueryVariant,
} from "@/features/ai-recruiter/services/discovery-query-builder.service";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import {
  employerMatchesTargetedConstraints,
  extractTargetedEmployerConstraints,
  type TargetedDiscoveryConstraints,
} from "@/features/ai-recruiter/services/targeted-employer-constraint.service";
import { runWithConcurrencySettled } from "@/lib/async/run-with-concurrency-settled";
import type { SearchResultItem } from "@/features/lead-intelligence/providers/manager/types";
import type { ProviderRequestTelemetry } from "@/features/ai-recruiter/services/provider-request-telemetry.service";
import {
  createEmptyProviderRequestTelemetry,
  recordDiscoveryQueryTelemetry,
} from "@/features/ai-recruiter/services/provider-request-telemetry.service";
import type { DiscoveryProviderDebugEntry } from "@/features/company-finder/discovery/discovery-provider-failover.types";
import { dedupeDiscoveryQueryVariants } from "@/features/company-finder/discovery/discovery-query-dedupe.service";
import {
  createDiscoveryRunApiBudget,
  type DiscoveryApiBudgetSnapshot,
} from "@/features/company-finder/discovery/discovery-run-api-budget.service";
import {
  buildProviderDegradedModeReport,
  type ProviderDegradedModeReport,
} from "@/features/company-finder/discovery/provider-degraded-mode.service";
import { isProviderQuotaExhausted } from "@/features/company-finder/discovery/provider-quota-registry.service";

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
  serpApiFallbackAttempted: boolean;
  serpApiFallbackSucceeded?: boolean;
  serpApiFallbackSkipped: boolean;
  serpApiFallbackError?: string | null;
  tavilyFailed: boolean;
  tavilyFailureCode: RunFailureCode | null;
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
  providerRequestTelemetry: ProviderRequestTelemetry;
  providerDegradedMode?: ProviderDegradedModeReport;
  discoveryQueryDuplicatesRemoved?: number;
  apiBudgetSnapshot?: DiscoveryApiBudgetSnapshot;
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

function vacancyTitleFromHit(title: string, url: string): string {
  const trimmed = title.replace(/\s*[|\-–—].*$/, "").trim();
  if (trimmed && !/^(werken bij|vacatures?)$/i.test(trimmed)) return trimmed;
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    if (!slug) return trimmed || "Vacature";
    return slug
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return trimmed || "Vacature";
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
  targetedConstraints?: TargetedDiscoveryConstraints;
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

  if (
    accepted
    && input.targetedConstraints?.mode === "targeted"
    && !employerMatchesTargetedConstraints({
      companyName: resolvedName ?? input.title,
      domain: officialDomain,
      website: officialDomain ? `https://${officialDomain}` : input.url,
      constraints: input.targetedConstraints,
    })
  ) {
    accepted = false;
    rejectionReason = "wrong_employer";
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
    vacancyTitle:
      classified.vacancyTitle
      ?? (hasConcreteJobUrl(input.url) ? vacancyTitleFromHit(input.title, input.url) : null),
    vacancyUrl: hasConcreteJobUrl(input.url) ? input.url : null,
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
  targetedConstraints?: TargetedDiscoveryConstraints,
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
      targetedConstraints,
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
      continue;
    }

    if (!existing.vacancyUrl && entry.vacancyUrl && hasConcreteJobUrl(entry.vacancyUrl)) {
      byDomain.set(key, {
        ...existing,
        vacancyUrl: entry.vacancyUrl,
        vacancyTitle: entry.vacancyTitle ?? existing.vacancyTitle,
        vacancySource: entry.vacancySource ?? existing.vacancySource,
        resultType: isConcreteVacancyDiscoveryResult(entry) ? entry.resultType : existing.resultType,
      });
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
  ensureProviderRegistryBootstrapped();
  const config = getAiRecruiterConfig();
  const selectedQueries = selectDiscoveryQueries(
    buildVacancyDrivenDiscoveryQueries(criteria, options.searchPlan),
    options.searchPlan?.maximum_companies ?? options.maxResults,
  );
  const dedupedQueries = dedupeDiscoveryQueryVariants(selectedQueries);
  const queryVariants = dedupedQueries.unique;
  const queriesGenerated = queryVariants.map((variant) => variant.query);
  const apiBudget = createDiscoveryRunApiBudget(criteria.aiRecruiterRunId ?? null);
  const targetedConstraints: TargetedDiscoveryConstraints =
    criteria.discoveryMode === "targeted"
      ? {
          mode: "targeted",
          employerNames: criteria.targetEmployerNames ?? [],
          employerDomains: criteria.targetEmployerDomains ?? [],
          notFoundMessage: "Doelwerkgever niet gevonden.",
        }
      : extractTargetedEmployerConstraints(options.searchPlan?.reasoning ?? "");
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
  let serpApiFallbackSkipped = false;
  let serpApiFallbackSkipReason: string | null = null;
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

  const skipProviderIds = new Set<import("@/features/company-finder/discovery/discovery-provider-failover.types").DiscoverySearchProviderId>();
  if (isProviderQuotaExhausted("tavily") || config.discoveryMaxHttpAttemptsTavily <= 0) {
    skipProviderIds.add("tavily");
  }
  let providerRequestTelemetry = createEmptyProviderRequestTelemetry();
  const aggregateProviderRuns: DiscoveryProviderDebugEntry[] = [];

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
    let querySerpFallbackAttempted = false;
    let querySerpFallbackSucceeded = false;
    let querySerpFallbackSkipped = false;
    let querySerpFallbackError: string | null = null;
    let queryTavilyFailed = false;
    let queryTavilyFailureCode: RunFailureCode | null = null;

    try {
      const execution = await executeQualityAwareDiscoveryQuery({
        query: variant.query,
        intent: variant.intent,
        maxResults: perQueryMax,
        timeoutMs: options.timeoutMs,
        desiredRoles,
        serpContext: {
          location: variant.location,
          role: variant.role,
          sector,
        },
        skipProviderIds,
        apiBudget,
        processHits: (hits, hitProviderId) =>
          processHits(hits, hitProviderId, variant, config.excludeRecruitmentAgencies, targetedConstraints),
      });

      aggregateProviderRuns.push(...execution.providerRuns);

      if (
        execution.tavilyFailureCode === "provider_quota_exhausted"
        || execution.tavilyFailureCode === "provider_rate_limited"
        || (execution.tavilyFailed && /432|usage limit|quota exceeded/i.test(execution.tavilyErrorSanitized ?? ""))
      ) {
        skipProviderIds.add("tavily");
      }

      providerId = execution.providerId;
      queryProvider = execution.providerId;
      providersUsed = execution.providersUsed;
      rawResultCount = execution.rawHitCount;
      tavilyRawHits += execution.tavilyRawHitCount;
      serpApiRawHits += execution.serpApiRawHitCount;
      queryTavilyUsefulRecall = execution.tavilyUsefulRecall;
      querySerpFallback = execution.serpApiFallbackTriggered;
      querySerpFallbackReason = execution.serpApiFallbackReason;
      querySerpFallbackAttempted = execution.serpApiFallbackAttempted;
      querySerpFallbackSucceeded = execution.serpApiFallbackSucceeded;
      querySerpFallbackSkipped = execution.serpApiFallbackSkipped;
      querySerpFallbackError = execution.serpApiFallbackError;
      queryTavilyFailed = execution.tavilyFailed;
      queryTavilyFailureCode = execution.tavilyFailureCode;

      if (execution.serpApiFallbackTriggered || execution.serpApiFallbackAttempted) {
        serpApiFallbackTriggered = true;
        serpApiFallbackReason = execution.serpApiFallbackReason;
      }
      if (execution.serpApiFallbackSkipped) {
        serpApiFallbackSkipped = true;
        serpApiFallbackSkipReason = execution.serpApiFallbackError;
      }
      if (execution.tavilyFailed && execution.tavilyErrorSanitized && !error) {
        error = execution.tavilyErrorSanitized;
      } else if (execution.serpApiFallbackError && !error) {
        error = sanitizeDiscoveryProviderError(execution.serpApiFallbackError);
      }
      if (execution.tavilyUsefulRecall) {
        tavilyUsefulRecall = true;
      }

      providerRequestTelemetry = recordDiscoveryQueryTelemetry(
        providerRequestTelemetry,
        execution.providerRuns,
      );

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
      const message = cause instanceof Error ? cause.message : "Query mislukt";
      error = sanitizeDiscoveryProviderError(message);
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
      serpApiFallbackAttempted: querySerpFallbackAttempted,
      serpApiFallbackSucceeded: querySerpFallbackSucceeded,
      serpApiFallbackSkipped: querySerpFallbackSkipped,
      serpApiFallbackError: querySerpFallbackError,
      tavilyFailed: queryTavilyFailed,
      tavilyFailureCode: queryTavilyFailureCode,
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
        serpApiFallbackAttempted: false,
        serpApiFallbackSkipped: false,
        tavilyFailed: true,
        tavilyFailureCode: null,
        durationMs: 0,
        error: sanitizeDiscoveryProviderError(
          entry.reason instanceof Error ? entry.reason.message : "Query mislukt",
        ),
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
      maxSupplementalQueries: Math.min(
        coverageGaps.length,
        config.discoverySupplementalQueryCap,
      ),
      processHits: (hits, hitProviderId, variant) =>
        processHits(hits, hitProviderId, variant, config.excludeRecruitmentAgencies, targetedConstraints),
    });

    if (supplemental.queriesExecuted > 0) {
      const supplementalRuns: DiscoveryProviderDebugEntry[] = Array.from(
        { length: supplemental.queriesExecuted },
        () => ({
          providerId: "serpapi",
          name: "SerpAPI supplemental",
          configured: true,
          started: true,
          success: supplemental.rawHits > 0,
          skipped: false,
          skipReason: null,
          resultCount: supplemental.rawHits,
          durationMs: 0,
          queryCount: 1,
        }),
      );
      for (const run of supplementalRuns) {
        providerRequestTelemetry = recordDiscoveryQueryTelemetry(providerRequestTelemetry, [run]);
      }

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
    serpApiFallbackSkipped,
    serpApiFallbackSkipReason,
    serpApiSupplementalQueries,
  });

  const funnel = buildFunnel(resultLogs, diagnostics, results.length, {
    serpApiFallbackTriggered,
    serpApiFallbackReason,
    tavilyUsefulRecall,
    queriesGenerated,
    usableRecallDiagnostics,
  });

  const successfulProviders = [
    ...new Set(
      aggregateProviderRuns.filter((run) => run.success).map((run) => run.providerId),
    ),
  ];

  const providerDegradedMode = buildProviderDegradedModeReport({
    providerRuns: aggregateProviderRuns,
    successfulProviderIds: successfulProviders,
    budget: apiBudget.snapshot(),
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
    providerRequestTelemetry,
    providerDegradedMode,
    discoveryQueryDuplicatesRemoved: dedupedQueries.duplicatesRemoved,
    apiBudgetSnapshot: apiBudget.snapshot(),
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
