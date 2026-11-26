import "server-only";

import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import {
  ensureProviderRegistryBootstrapped,
  getProviderRegistry,
} from "@/features/lead-intelligence/providers/manager/provider-registry";
import { executeWithResilience } from "@/features/lead-intelligence/providers/manager/provider-executor";
import { buildCacheKey, getCached } from "@/features/lead-intelligence/providers/manager/provider-cache";
import { parseHttpStatusFromProviderMessage } from "@/features/lead-intelligence/providers/manager/provider-retry-policy";
import {
  isProviderQuotaExhausted,
  markProviderQuotaExhausted,
} from "@/features/company-finder/discovery/provider-quota-registry.service";
import {
  getBingSearchApiKey,
  getBraveSearchApiKey,
  getGoogleCseConfig,
  getOpenAiApiKey,
  getSerpApiKey,
  getTavilyApiKey,
} from "@/features/lead-intelligence/providers/manager/provider-env";
import { getSearchExecutor } from "@/features/lead-intelligence/providers/manager/search-providers";
import type { SearchResultItem } from "@/features/lead-intelligence/providers/manager/types";
import {
  DISCOVERY_ALL_PROVIDERS_FAILED_MESSAGE,
  DISCOVERY_SEARCH_PROVIDER_PRIORITY,
  type DiscoveryProviderDebugEntry,
  type DiscoveryProviderSkipReason,
  type DiscoverySearchFailoverOptions,
  type DiscoverySearchFailoverResult,
  type DiscoverySearchProviderId,
} from "@/features/company-finder/discovery/discovery-provider-failover.types";

const PROVIDER_DISPLAY_NAMES: Record<DiscoverySearchProviderId, string> = {
  tavily: "Tavily",
  "brave-search": "Brave",
  "google-cse": "Google",
  "bing-search": "Bing",
  serpapi: "SerpAPI",
  exa: "Exa",
  "openai-web-search": "OpenAI Web Search",
};

function canonicalResultUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

export function isDiscoverySearchProviderConfigured(providerId: DiscoverySearchProviderId): boolean {
  switch (providerId) {
    case "tavily":
      return Boolean(getTavilyApiKey());
    case "brave-search":
      return Boolean(getBraveSearchApiKey());
    case "google-cse":
      return Boolean(getGoogleCseConfig());
    case "bing-search":
      return Boolean(getBingSearchApiKey());
    case "serpapi":
      return Boolean(getSerpApiKey());
    case "exa":
      return false;
    case "openai-web-search":
      return Boolean(getOpenAiApiKey());
    default:
      return false;
  }
}

export function classifyDiscoveryProviderError(error: unknown): DiscoveryProviderSkipReason {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  const httpMatch = /http\s+(\d{3})/i.exec(message);
  const status = httpMatch ? Number(httpMatch[1]) : null;

  if (status === 401 || /unauthorized|invalid api key|authentication|401/.test(lower)) {
    return "http_401";
  }
  if (status === 403 || /forbidden|403/.test(lower)) {
    return "http_403";
  }
  if (
    status === 429
    || status === 432
    || /rate limit|too many requests|429|432|quota exceeded|usage limit|quota bereikt|insufficient quota|exceeds your plan/.test(
      lower,
    )
  ) {
    return "quota_exceeded";
  }
  if (/timeout|time-out|timed out|abort|deadline|etimedout|econnaborted/.test(lower)) {
    return "timeout";
  }
  if (
    /fetch failed|network|econnrefused|enotfound|socket|dns|getaddrinfo|ECONNRESET/.test(lower)
  ) {
    return "network_error";
  }
  if (/api key ontbreekt|niet geconfigureerd|not configured|config ontbreekt|missing/.test(lower)) {
    return "missing_api_key";
  }
  if (/0 resultaten|geen resultaten|empty results/.test(lower)) {
    return "empty_results";
  }

  return "unknown_error";
}

function buildSkippedEntry(
  providerId: DiscoverySearchProviderId,
  reason: DiscoveryProviderSkipReason,
  configured: boolean,
  durationMs = 0,
  errorMessage?: string | null,
): DiscoveryProviderDebugEntry {
  return {
    providerId,
    name: PROVIDER_DISPLAY_NAMES[providerId],
    configured,
    started: configured,
    success: false,
    skipped: true,
    skipReason: reason,
    resultCount: 0,
    durationMs,
    errorMessage: errorMessage ?? null,
  };
}

function buildSuccessEntry(
  providerId: DiscoverySearchProviderId,
  resultCount: number,
  durationMs: number,
  extra?: Partial<Pick<DiscoveryProviderDebugEntry, "httpInvoked" | "cacheHit">>,
): DiscoveryProviderDebugEntry {
  return {
    providerId,
    name: PROVIDER_DISPLAY_NAMES[providerId],
    configured: true,
    started: true,
    success: true,
    skipped: false,
    skipReason: null,
    resultCount,
    durationMs,
    httpInvoked: extra?.httpInvoked ?? true,
    cacheHit: extra?.cacheHit ?? false,
  };
}

export async function executeDiscoverySearchWithFailover(
  query: string,
  maxResults: number,
  options: DiscoverySearchFailoverOptions = {},
): Promise<DiscoverySearchFailoverResult> {
  ensureProviderRegistryBootstrapped();
  const stopOnFirstSuccess = options.stopOnFirstSuccess ?? false;
  const providerOrder = options.providerPriority ?? DISCOVERY_SEARCH_PROVIDER_PRIORITY;
  const maxProviderAttempts = options.maxProviderAttempts ?? providerOrder.length;

  const providerRuns: DiscoveryProviderDebugEntry[] = [];
  const combined: Array<SearchResultItem & { providerId: string }> = [];
  const seenUrls = new Set<string>();
  const successfulProviderIds: string[] = [];
  let attempts = 0;

  pipelineDebug("discovery.failover.start", { query, maxResults, stopOnFirstSuccess, maxProviderAttempts });

  for (const providerId of providerOrder) {
    if (attempts >= maxProviderAttempts) break;

    if (options.skipProviderIds?.has(providerId) || isProviderQuotaExhausted(providerId)) {
      providerRuns.push({
        ...buildSkippedEntry(providerId, "quota_exceeded", isDiscoverySearchProviderConfigured(providerId)),
        httpInvoked: false,
      });
      continue;
    }

    const configured = isDiscoverySearchProviderConfigured(providerId);

    if (!configured) {
      providerRuns.push(buildSkippedEntry(providerId, "missing_api_key", false));
      continue;
    }

    const executor = getSearchExecutor(providerId);
    if (!executor) {
      providerRuns.push(buildSkippedEntry(providerId, "no_executor", true));
      continue;
    }

    attempts += 1;

    const adapter = getProviderRegistry().get(providerId);
    const provider = adapter?.definition ?? {
      id: providerId,
      name: PROVIDER_DISPLAY_NAMES[providerId],
      timeoutMs: 20_000,
      maxRetries: 1,
      rateLimitPerMinute: 60,
      cacheEnabled: true,
      cacheTtlMs: 300_000,
    };

    const cacheKey = `${query}:${maxResults}:${providerId}`;
    const cacheLookupKey =
      provider.cacheEnabled !== false ? buildCacheKey(providerId, cacheKey) : null;
    const cachePrefetch = cacheLookupKey ? getCached<SearchResultItem[]>(cacheLookupKey) : null;

    const started = Date.now();

    try {
      const execution = await executeWithResilience(
        {
          providerId,
          timeoutMs: provider.timeoutMs,
          maxRetries: provider.maxRetries,
          rateLimitPerMinute: provider.rateLimitPerMinute,
          cacheKey,
          useCache: provider.cacheEnabled ?? true,
          cacheTtlMs: provider.cacheTtlMs,
        },
        async () => {
          if (!cachePrefetch && options.apiBudget) {
            const budgetCheck = options.apiBudget.tryConsumeHttpAttempt(providerId);
            if (!budgetCheck.allowed) {
              throw new Error(`http_budget:${budgetCheck.reason ?? "exhausted"}`);
            }
          }
          return executor(query, maxResults);
        },
      );

      if (execution.fromCache) {
        options.apiBudget?.recordCacheHit(providerId);
      }

      if (execution.data.length === 0) {
        providerRuns.push({
          ...buildSkippedEntry(providerId, "empty_results", true, Date.now() - started),
          httpInvoked: !execution.fromCache,
          cacheHit: execution.fromCache,
        });
        continue;
      }

      let added = 0;
      for (const item of execution.data) {
        const key = canonicalResultUrl(item.url);
        if (!key || seenUrls.has(key)) continue;
        seenUrls.add(key);
        combined.push({ ...item, providerId });
        added += 1;
      }

      providerRuns.push(
        buildSuccessEntry(providerId, added, Date.now() - started, {
          httpInvoked: !execution.fromCache,
          cacheHit: execution.fromCache,
        }),
      );
      successfulProviderIds.push(providerId);

      pipelineDebug("discovery.failover.provider.success", {
        providerId,
        added,
        totalCombined: combined.length,
      });

      if (stopOnFirstSuccess && added > 0) {
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("http_budget:")) {
        providerRuns.push({
          ...buildSkippedEntry(providerId, "quota_exceeded", true, Date.now() - started, message.slice("http_budget:".length)),
          httpInvoked: false,
          budgetBlocked: true,
        });
        continue;
      }
      const reason = classifyDiscoveryProviderError(error);
      if (reason === "quota_exceeded") {
        markProviderQuotaExhausted(
          providerId,
          message.slice(0, 280),
          parseHttpStatusFromProviderMessage(message),
        );
      }
      providerRuns.push({
        ...buildSkippedEntry(providerId, reason, true, Date.now() - started, message.slice(0, 280)),
        httpInvoked: true,
      });
      pipelineWarn("discovery.failover.provider.skipped", {
        providerId,
        reason,
        message,
      });
    }
  }

  const allProvidersSkipped = successfulProviderIds.length === 0;

  pipelineDebug("discovery.failover.complete", {
    query,
    combinedCount: combined.length,
    successfulProviderIds,
    allProvidersSkipped,
    attempts,
  });

  return {
    results: combined.map((item) => ({
      title: item.title,
      url: item.url,
      description: item.description ?? "",
      providerId: item.providerId,
    })),
    providerRuns,
    successfulProviderIds,
    allProvidersSkipped,
  };
}

function mergeProviderRuns(
  aggregate: Map<DiscoverySearchProviderId, DiscoveryProviderDebugEntry>,
  runs: DiscoveryProviderDebugEntry[],
): void {
  for (const run of runs) {
    const existing = aggregate.get(run.providerId);
    if (!existing) {
      aggregate.set(run.providerId, run);
      continue;
    }

    aggregate.set(run.providerId, {
      ...existing,
      started: existing.started || run.started,
      success: existing.success || run.success,
      skipped: existing.success ? false : existing.skipped || run.skipped,
      skipReason: existing.success ? null : (run.skipReason ?? existing.skipReason),
      resultCount: existing.resultCount + run.resultCount,
      durationMs: existing.durationMs + run.durationMs,
    });
  }
}

export function mergeDiscoveryProviderRuns(
  runs: DiscoveryProviderDebugEntry[],
): DiscoveryProviderDebugEntry[] {
  const aggregate = new Map<DiscoverySearchProviderId, DiscoveryProviderDebugEntry>();

  for (const providerId of DISCOVERY_SEARCH_PROVIDER_PRIORITY) {
    const configured = isDiscoverySearchProviderConfigured(providerId);
    aggregate.set(providerId, {
      providerId,
      name: PROVIDER_DISPLAY_NAMES[providerId],
      configured,
      started: false,
      success: false,
      skipped: !configured,
      skipReason: configured ? null : "missing_api_key",
      resultCount: 0,
      durationMs: 0,
    });
  }

  mergeProviderRuns(aggregate, runs);

  return DISCOVERY_SEARCH_PROVIDER_PRIORITY.map((providerId) => aggregate.get(providerId)!);
}

export function assertDiscoveryProvidersAvailable(
  providerRuns: DiscoveryProviderDebugEntry[],
  totalRawResults: number,
): void {
  const anySuccess = providerRuns.some((run) => run.success);
  if (!anySuccess && totalRawResults === 0) {
    throw new Error(DISCOVERY_ALL_PROVIDERS_FAILED_MESSAGE);
  }
}

export { DISCOVERY_ALL_PROVIDERS_FAILED_MESSAGE };