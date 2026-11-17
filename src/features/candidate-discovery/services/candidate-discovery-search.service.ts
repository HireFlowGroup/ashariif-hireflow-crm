import { getCandidateDiscoveryConfig } from "@/features/candidate-discovery/config/candidate-discovery.config";
import type {
  AttributedSearchResult,
  CandidateDiscoverySearchOutcome,
  QuerySearchAttempt,
} from "@/features/candidate-discovery/domain/candidate-discovery.types";
import {
  CandidateDiscoveryError,
  classifyProviderSearchError,
} from "@/features/candidate-discovery/domain/candidate-discovery.errors";
import type { SearchChainResult } from "@/features/lead-intelligence/providers/manager/provider-manager";

export type SearchChainExecutor = (query: string, maxResults: number) => Promise<SearchChainResult>;

export type RunCandidateDiscoverySearchInput = {
  queries: string[];
  executor: SearchChainExecutor;
  maxResultsPerQuery?: number;
  deadlineMs?: number;
};

function messageFromError(error: unknown): string {
  if (error instanceof CandidateDiscoveryError) return error.message;
  if (error instanceof Error) return error.message;
  return "Onbekende zoekfout";
}

export async function runCandidateDiscoverySearch(
  input: RunCandidateDiscoverySearchInput,
): Promise<CandidateDiscoverySearchOutcome> {
  const config = getCandidateDiscoveryConfig();
  const maxResultsPerQuery = input.maxResultsPerQuery ?? config.maxResultsPerQuery;
  const startedAt = Date.now();
  const deadlineMs = input.deadlineMs ?? config.runTimeoutMs;

  const attempts: QuerySearchAttempt[] = [];
  const items: AttributedSearchResult[] = [];
  let providerFailures = 0;

  for (const query of input.queries) {
    if (Date.now() - startedAt >= deadlineMs) {
      attempts.push({
        query,
        success: false,
        errorCode: "query_timeout",
        errorMessage: "Query overgeslagen — run timeout bereikt.",
        resultCount: 0,
        durationMs: 0,
      });
      providerFailures += 1;
      continue;
    }

    const queryStarted = Date.now();
    try {
      const chain = await input.executor(query, maxResultsPerQuery);
      const durationMs = Date.now() - queryStarted;

      attempts.push({
        query,
        success: true,
        providerId: chain.meta.providerId,
        resultCount: chain.results.length,
        durationMs,
        meta: chain.meta,
      });

      for (const result of chain.results) {
        items.push({
          ...result,
          sourceQuery: query,
          sourceProvider: chain.meta.providerId,
        });
      }
    } catch (error) {
      const durationMs = Date.now() - queryStarted;
      const message = messageFromError(error);
      const errorCode =
        error instanceof CandidateDiscoveryError ? error.code : classifyProviderSearchError(message);

      attempts.push({
        query,
        success: false,
        errorCode,
        errorMessage: message,
        resultCount: 0,
        durationMs,
      });
      providerFailures += 1;
    }
  }

  const allQueriesFailed = attempts.length > 0 && attempts.every((a) => !a.success);

  return {
    attempts,
    items,
    providerFailures,
    allQueriesFailed,
  };
}

/** Default executor voor latere fasen — niet gebruiken in unit tests zonder mock. */
export async function createProviderManagerSearchExecutor(): Promise<SearchChainExecutor> {
  const { getProviderManager } = await import("@/features/lead-intelligence/providers/manager");
  const manager = getProviderManager();

  if (!manager.hasSearchCapability()) {
    throw new CandidateDiscoveryError("no_search_capability");
  }

  return async (query, maxResults) => manager.executeSearchChain(query, maxResults);
}