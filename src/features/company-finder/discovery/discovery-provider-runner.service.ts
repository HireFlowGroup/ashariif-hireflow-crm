import "server-only";

import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import { mergeEnrichedDiscoveryResults } from "@/features/company-finder/discovery/discovery-result-dedupe.service";
import {
  evaluateUsefulRecall,
  shouldTriggerSerpApiFallback,
  type UsefulRecallMetrics,
} from "@/features/company-finder/discovery/discovery-useful-recall.service";
import type { DiscoveryQueryVariant } from "@/features/ai-recruiter/services/discovery-query-builder.service";
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
  tavilyUsefulRecall: boolean;
  tavilyFailed: boolean;
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
  processHits: (
    hits: SearchResultItem[],
    providerId: string,
  ) => EnrichedDiscoveryResult[];
}): Promise<QualityAwareQueryResult> {
  const manager = getProviderManager();
  const providersUsed: string[] = [];
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

  try {
    const tavilyExecution = await manager.executeSingleProviderSearch(
      TAVILY_PROVIDER_ID,
      input.query,
      input.maxResults,
      input.timeoutMs,
    );
    tavilyHits = tavilyExecution.results;
    tavilyRawHitCount = tavilyExecution.results.length;
    providersUsed.push(TAVILY_PROVIDER_ID);
    tavilyEnriched = input.processHits(tavilyHits, TAVILY_PROVIDER_ID);
    tavilyMetrics = evaluateUsefulRecall(tavilyEnriched, input.desiredRoles, tavilyRawHitCount);
  } catch (error) {
    tavilyFailed = true;
    tavilyError = error instanceof Error ? error.message : "Tavily query mislukt";
    tavilyMetrics = evaluateUsefulRecall([], input.desiredRoles, 0);
  }

  let combinedEnriched = tavilyEnriched;
  let combinedHits = tavilyHits;
  let providerId = TAVILY_PROVIDER_ID;

  const fallbackDecision = shouldTriggerSerpApiFallback(tavilyMetrics, {
    serpApiAvailable: Boolean(getSerpApiKey()),
    tavilyFailed,
    vacancyFocusedQuery: isVacancyFocusedDiscoveryIntent(input.intent),
  });

  if (fallbackDecision.trigger) {
    serpApiFallbackTriggered = true;
    serpApiFallbackAttempted = true;
    serpApiFallbackReason = fallbackDecision.reason;

    const serpExecution = await executeSerpApiDiscoveryQuery({
      query: input.query,
      maxResults: input.maxResults,
      timeoutMs: input.timeoutMs,
      processHits: input.processHits,
    });

    serpApiRawHitCount = serpExecution.rawHitCount;
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
    serpApiFallbackError: serpApiFallbackError ?? (tavilyFailed ? tavilyError : null),
    tavilyUsefulRecall: tavilyMetrics.usefulRecall,
    tavilyFailed,
  };
}
