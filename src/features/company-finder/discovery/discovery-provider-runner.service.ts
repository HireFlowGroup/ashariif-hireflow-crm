import "server-only";

import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import { mergeEnrichedDiscoveryResults } from "@/features/company-finder/discovery/discovery-result-dedupe.service";
import {
  evaluateUsefulRecall,
  shouldTriggerSerpApiFallback,
  type UsefulRecallMetrics,
} from "@/features/company-finder/discovery/discovery-useful-recall.service";
import type { DiscoveryQueryVariant } from "@/features/ai-recruiter/services/discovery-query-builder.service";
import {
  classifyProviderError,
  parseProviderHttpStatus,
  sanitizeDiscoveryProviderError,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";
import type { RunFailureCode } from "@/features/ai-recruiter/domain/run-diagnostics";
import { executeDiscoverySearchWithFailover } from "@/features/company-finder/discovery/discovery-provider-failover.service";
import {
  resolveAiRecruiterDiscoveryProviderPriority,
  resolveDiscoveryMaxProviderAttempts,
} from "@/features/company-finder/discovery/discovery-provider-resilience.service";
import type {
  DiscoveryProviderDebugEntry,
  DiscoverySearchProviderId,
} from "@/features/company-finder/discovery/discovery-provider-failover.types";
import type { DiscoveryRunApiBudget } from "@/features/company-finder/discovery/discovery-run-api-budget.service";
import { isProviderQuotaExhausted } from "@/features/company-finder/discovery/provider-quota-registry.service";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import { getSerpApiKey } from "@/features/lead-intelligence/providers/manager/provider-env";
import type { SearchResultItem } from "@/features/lead-intelligence/providers/manager/types";

export type QualityAwareQueryResult = {
  providerId: string;
  providersUsed: string[];
  rawResults: SearchResultItem[];
  rawHitCount: number;
  tavilyRawHitCount: number;
  serpApiRawHitCount: number;
  enrichedResults: EnrichedDiscoveryResult[];
  tavilyMetrics: UsefulRecallMetrics;
  combinedMetrics: UsefulRecallMetrics;
  serpApiFallbackTriggered: boolean;
  serpApiFallbackAttempted: boolean;
  serpApiFallbackSucceeded: boolean;
  serpApiFallbackReason: string | null;
  serpApiFallbackError: string | null;
  serpApiFallbackRequired: boolean;
  serpApiFallbackSkipped: boolean;
  tavilyUsefulRecall: boolean;
  tavilyFailed: boolean;
  tavilyFailureCode: RunFailureCode | null;
  tavilyErrorSanitized: string | null;
  providerRuns: DiscoveryProviderDebugEntry[];
};

const TAVILY_PROVIDER_ID = "tavily";
const SERPAPI_PROVIDER_ID = "serpapi";

const VACANCY_FOCUSED_INTENTS = new Set<DiscoveryQueryVariant["intent"]>([
  "vacancy",
  "careers",
  "role_specific",
  "vacancy_detail",
]);

export function isVacancyFocusedDiscoveryIntent(intent: DiscoveryQueryVariant["intent"]): boolean {
  return VACANCY_FOCUSED_INTENTS.has(intent);
}

export async function executeSerpApiDiscoveryQuery(input: {
  query: string;
  maxResults: number;
  timeoutMs: number;
  processHits: (hits: SearchResultItem[], providerId: string) => EnrichedDiscoveryResult[];
}): Promise<{
  enrichedResults: EnrichedDiscoveryResult[];
  rawResults: SearchResultItem[];
  rawHitCount: number;
  error: string | null;
}> {
  if (!getSerpApiKey()) {
    return { enrichedResults: [], rawResults: [], rawHitCount: 0, error: "SerpAPI niet geconfigureerd" };
  }

  try {
    const manager = getProviderManager();
    const execution = await manager.executeSingleProviderSearch(
      SERPAPI_PROVIDER_ID,
      input.query,
      input.maxResults,
      input.timeoutMs,
    );
    const enrichedResults = input.processHits(execution.results, SERPAPI_PROVIDER_ID);
    return {
      enrichedResults,
      rawResults: execution.results,
      rawHitCount: execution.results.length,
      error: null,
    };
  } catch (error) {
    return {
      enrichedResults: [],
      rawResults: [],
      rawHitCount: 0,
      error: error instanceof Error ? error.message : "SerpAPI query mislukt",
    };
  }
}

export async function executeQualityAwareDiscoveryQuery(input: {
  query: string;
  intent: DiscoveryQueryVariant["intent"];
  maxResults: number;
  timeoutMs: number;
  desiredRoles: string[];
  skipProviderIds?: ReadonlySet<DiscoverySearchProviderId>;
  apiBudget?: DiscoveryRunApiBudget;
  processHits: (
    hits: SearchResultItem[],
    providerId: string,
  ) => EnrichedDiscoveryResult[];
}): Promise<QualityAwareQueryResult> {
  const providersUsed: string[] = [];
  const maxProviderAttempts = resolveDiscoveryMaxProviderAttempts();
  const recruiterProviderPriority = resolveAiRecruiterDiscoveryProviderPriority();
  let serpApiFallbackTriggered = false;
  let serpApiFallbackAttempted = false;
  let serpApiFallbackSucceeded = false;
  let serpApiFallbackReason: string | null = null;
  let serpApiFallbackError: string | null = null;
  let tavilyHits: SearchResultItem[] = [];
  let tavilyEnriched: EnrichedDiscoveryResult[] = [];
  let tavilyRawHitCount = 0;
  let serpApiRawHitCount = 0;
  let tavilyMetrics = evaluateUsefulRecall([], input.desiredRoles, 0);
  let tavilyFailed = false;
  let tavilyError: string | null = null;
  let tavilyFailureCode: RunFailureCode | null = null;
  let serpApiFallbackRequired = false;
  let serpApiFallbackSkipped = false;
  const providerRuns: DiscoveryProviderDebugEntry[] = [];

  const tavilySkipped =
    input.skipProviderIds?.has(TAVILY_PROVIDER_ID) || isProviderQuotaExhausted(TAVILY_PROVIDER_ID);
  const failover = await executeDiscoverySearchWithFailover(input.query, input.maxResults, {
    stopOnFirstSuccess: !tavilySkipped,
    maxProviderAttempts,
    skipProviderIds: input.skipProviderIds,
    apiBudget: input.apiBudget,
    providerPriority: tavilySkipped
      ? ([SERPAPI_PROVIDER_ID] as const)
      : recruiterProviderPriority,
  });

  const hitsByProvider = new Map<string, SearchResultItem[]>();
  for (const row of failover.results) {
    const bucket = hitsByProvider.get(row.providerId) ?? [];
    bucket.push({ title: row.title, url: row.url, description: row.description });
    hitsByProvider.set(row.providerId, bucket);
  }

  tavilyHits = hitsByProvider.get(TAVILY_PROVIDER_ID) ?? [];
  tavilyRawHitCount = tavilyHits.length;
  tavilyEnriched = tavilyHits.length > 0 ? input.processHits(tavilyHits, TAVILY_PROVIDER_ID) : [];
  tavilyMetrics = evaluateUsefulRecall(tavilyEnriched, input.desiredRoles, tavilyRawHitCount);

  const tavilyRun = failover.providerRuns.find((run) => run.providerId === TAVILY_PROVIDER_ID);
  if (tavilyRun && !tavilyRun.success && tavilyRawHitCount === 0) {
    tavilyFailed = true;
    tavilyError = tavilyRun.errorMessage ?? "Tavily query mislukt";
    tavilyFailureCode = classifyProviderError(tavilyError, parseProviderHttpStatus(tavilyError));
  }

  if (failover.allProvidersSkipped) {
    tavilyFailed = true;
    const primary =
      failover.providerRuns.find((run) => run.errorMessage)
      ?? failover.providerRuns.find((run) => run.providerId === TAVILY_PROVIDER_ID);
    tavilyError = primary?.errorMessage ?? "Geen werkende searchprovider beschikbaar.";
    tavilyFailureCode = classifyProviderError(tavilyError, parseProviderHttpStatus(tavilyError));
  }

  let combinedEnriched: EnrichedDiscoveryResult[] = [];
  let combinedHits: SearchResultItem[] = [];
  for (const [hitProviderId, hits] of hitsByProvider) {
    combinedHits.push(...hits);
    combinedEnriched.push(...input.processHits(hits, hitProviderId));
    providersUsed.push(hitProviderId);
    if (hitProviderId === SERPAPI_PROVIDER_ID) {
      serpApiRawHitCount += hits.length;
    }
  }

  let providerId = failover.successfulProviderIds[0] ?? TAVILY_PROVIDER_ID;
  if (failover.successfulProviderIds.length > 1) {
    providerId = failover.successfulProviderIds.join("+");
  }

  const vacancyFocusedQuery = isVacancyFocusedDiscoveryIntent(input.intent);
  const serpConfigured = Boolean(getSerpApiKey());
  const serpAlreadyUsed = failover.successfulProviderIds.includes(SERPAPI_PROVIDER_ID);
  const fallbackNeeded = shouldTriggerSerpApiFallback(tavilyMetrics, {
    serpApiAvailable: true,
    tavilyFailed,
    vacancyFocusedQuery,
  });
  serpApiFallbackRequired = fallbackNeeded.trigger;
  serpApiFallbackReason = fallbackNeeded.reason;

  providerRuns.push(...failover.providerRuns);

  if (fallbackNeeded.trigger && serpConfigured && !serpAlreadyUsed) {
    serpApiFallbackTriggered = true;
    serpApiFallbackAttempted = true;

    const serpStarted = Date.now();
    const serpExecution = await executeSerpApiDiscoveryQuery({
      query: input.query,
      maxResults: input.maxResults,
      timeoutMs: input.timeoutMs,
      processHits: input.processHits,
    });

    serpApiRawHitCount = serpExecution.rawHitCount;
    providerRuns.push({
      providerId: SERPAPI_PROVIDER_ID,
      name: "SerpAPI fallback",
      configured: true,
      started: true,
      success: !serpExecution.error && (serpExecution.enrichedResults.length > 0 || serpExecution.rawHitCount > 0),
      skipped: false,
      skipReason: null,
      resultCount: serpExecution.rawHitCount,
      durationMs: Date.now() - serpStarted,
      errorMessage: serpExecution.error,
    });

    if (serpExecution.error) {
      serpApiFallbackError = serpExecution.error;
    } else if (serpExecution.enrichedResults.length > 0 || serpExecution.rawHitCount > 0) {
      serpApiFallbackSucceeded = true;
      combinedEnriched = mergeEnrichedDiscoveryResults(tavilyEnriched, serpExecution.enrichedResults);
      combinedHits = [...tavilyHits, ...serpExecution.rawResults];
      providersUsed.push(SERPAPI_PROVIDER_ID);
      providerId = tavilyEnriched.length === 0 ? SERPAPI_PROVIDER_ID : `${TAVILY_PROVIDER_ID}+${SERPAPI_PROVIDER_ID}`;
    } else {
      serpApiFallbackError = "SerpAPI leverde 0 resultaten";
    }
  } else if (fallbackNeeded.trigger && !serpConfigured) {
    serpApiFallbackTriggered = true;
    serpApiFallbackSkipped = true;
    serpApiFallbackError = "SerpAPI fallback vereist maar SERPAPI_API_KEY ontbreekt";
  }

  const combinedMetrics = evaluateUsefulRecall(
    combinedEnriched,
    input.desiredRoles,
    tavilyRawHitCount + serpApiRawHitCount,
  );

  return {
    providerId,
    providersUsed: [...new Set(providersUsed)],
    rawResults: combinedHits,
    rawHitCount: tavilyRawHitCount + serpApiRawHitCount,
    tavilyRawHitCount,
    serpApiRawHitCount,
    enrichedResults: combinedEnriched,
    tavilyMetrics,
    combinedMetrics,
    serpApiFallbackTriggered,
    serpApiFallbackAttempted,
    serpApiFallbackSucceeded,
    serpApiFallbackReason,
    serpApiFallbackError: serpApiFallbackError
      ?? (tavilyFailed ? sanitizeDiscoveryProviderError(tavilyError ?? "Tavily query mislukt") : null),
    serpApiFallbackRequired,
    serpApiFallbackSkipped,
    tavilyUsefulRecall: tavilyMetrics.usefulRecall,
    tavilyFailed,
    tavilyFailureCode,
    tavilyErrorSanitized: tavilyFailed ? sanitizeDiscoveryProviderError(tavilyError ?? "") : null,
    providerRuns,
  };
}
