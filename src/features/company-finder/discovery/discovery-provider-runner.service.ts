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
  enrichedResults: EnrichedDiscoveryResult[];
  tavilyMetrics: UsefulRecallMetrics;
  combinedMetrics: UsefulRecallMetrics;
  serpApiFallbackTriggered: boolean;
  serpApiFallbackReason: string | null;
  tavilyUsefulRecall: boolean;
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
  let serpApiFallbackReason: string | null = null;
  let tavilyHits: SearchResultItem[] = [];
  let tavilyEnriched: EnrichedDiscoveryResult[] = [];
  let tavilyMetrics = evaluateUsefulRecall([], input.desiredRoles);
  let tavilyFailed = false;

  try {
    const tavilyExecution = await manager.executeSingleProviderSearch(
      TAVILY_PROVIDER_ID,
      input.query,
      input.maxResults,
      input.timeoutMs,
    );
    tavilyHits = tavilyExecution.results;
    providersUsed.push(TAVILY_PROVIDER_ID);
    tavilyEnriched = input.processHits(tavilyHits, TAVILY_PROVIDER_ID);
    tavilyMetrics = evaluateUsefulRecall(tavilyEnriched, input.desiredRoles);
  } catch {
    tavilyFailed = true;
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
    try {
      const serpExecution = await manager.executeSingleProviderSearch(
        SERPAPI_PROVIDER_ID,
        input.query,
        input.maxResults,
        input.timeoutMs,
      );
      const serpEnriched = input.processHits(serpExecution.results, SERPAPI_PROVIDER_ID);
      combinedEnriched = mergeEnrichedDiscoveryResults(tavilyEnriched, serpEnriched);
      combinedHits = [...tavilyHits, ...serpExecution.results];
      providersUsed.push(SERPAPI_PROVIDER_ID);
      providerId = serpEnriched.length > 0 && tavilyEnriched.length === 0
        ? SERPAPI_PROVIDER_ID
        : `${TAVILY_PROVIDER_ID}+${SERPAPI_PROVIDER_ID}`;
      serpApiFallbackTriggered = true;
      serpApiFallbackReason = fallbackDecision.reason;
    } catch {
      // Keep Tavily-only results when fallback also fails.
      if (tavilyFailed) throw new Error(fallbackDecision.reason ?? "Discovery query mislukt");
    }
  }

  if (combinedEnriched.length === 0 && tavilyFailed) {
    throw new Error(fallbackDecision.reason ?? "Discovery query mislukt");
  }

  const combinedMetrics = evaluateUsefulRecall(combinedEnriched, input.desiredRoles);

  return {
    providerId,
    providersUsed: [...new Set(providersUsed)],
    rawResults: combinedHits,
    enrichedResults: combinedEnriched,
    tavilyMetrics,
    combinedMetrics,
    serpApiFallbackTriggered,
    serpApiFallbackReason,
    tavilyUsefulRecall: tavilyMetrics.usefulRecall,
  };
}
