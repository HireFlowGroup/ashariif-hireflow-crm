import { randomUUID } from "crypto";

import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import { executeWithResilience } from "@/features/lead-intelligence/providers/manager/provider-executor";
import type { ProviderAdapter } from "@/features/lead-intelligence/providers/manager/provider-adapter.types";
import type { ProviderRegistry } from "@/features/lead-intelligence/providers/manager/provider-registry";
import { clearProviderCache } from "@/features/lead-intelligence/providers/manager/provider-cache";
import {
  getProviderRuntimeStats,
  recordProviderFailure,
  recordProviderSuccess,
  resetProviderStats,
} from "@/features/lead-intelligence/providers/manager/provider-stats.store";
import { shouldEscalateToPlaywright } from "@/features/lead-intelligence/providers/manager/crawler-providers";
import type {
  ChainExecutionMeta,
  CrawlResult,
  ProviderHealthSnapshot,
  ProviderTestResult,
  SearchResultItem,
} from "@/features/lead-intelligence/providers/manager/types";

export type SearchChainResult = {
  results: SearchResultItem[];
  meta: ChainExecutionMeta;
};

export type CrawlChainResult = {
  result: CrawlResult;
  meta: ChainExecutionMeta;
};

function pickFastestProvider(adapters: ProviderAdapter[]): ProviderAdapter[] {
  return [...adapters].sort((a, b) => {
    const statsA = getProviderRuntimeStats(
      a.definition.id,
      a.definition.enabled,
      a.definition.maxRetries,
      a.definition.cacheEnabled,
    );
    const statsB = getProviderRuntimeStats(
      b.definition.id,
      b.definition.enabled,
      b.definition.maxRetries,
      b.definition.cacheEnabled,
    );

    if (statsA.avgResponseMs === 0 && statsB.avgResponseMs === 0) {
      return a.definition.fallbackPriority - b.definition.fallbackPriority;
    }
    if (statsA.avgResponseMs === 0) return 1;
    if (statsB.avgResponseMs === 0) return -1;
    return statsA.avgResponseMs - statsB.avgResponseMs;
  });
}

export class ProviderManager {
  constructor(private readonly registry: ProviderRegistry) {}

  getAvailableProviders(): ProviderHealthSnapshot[] {
    return this.registry.getAll().map((adapter) => ({
      ...adapter.definition,
      ...getProviderRuntimeStats(
        adapter.definition.id,
        adapter.definition.enabled,
        adapter.definition.maxRetries,
        adapter.definition.cacheEnabled,
      ),
    }));
  }

  hasSearchCapability(): boolean {
    return this.registry.hasSearchCapability();
  }

  async runHealthChecks(): Promise<ProviderHealthSnapshot[]> {
    const adapters = this.registry.getAll().filter((adapter) => adapter.definition.enabled);
    await Promise.all(
      adapters.map(async (adapter) => {
        try {
          await this.testProvider(adapter.definition.id);
        } catch {
          // stats recorded during test
        }
      }),
    );
    return this.getAvailableProviders();
  }

  async executeSearchChain(query: string, maxResults: number): Promise<SearchChainResult> {
    const enabled = this.registry
      .getByCategory("search")
      .filter((adapter) => adapter.definition.enabled && adapter.executeSearch);

    pipelineDebug("search.chain.providers", {
      query,
      maxResults,
      searchProviders: enabled.map((adapter) => ({
        id: adapter.definition.id,
        name: adapter.definition.name,
        enabled: adapter.definition.enabled,
        skipReason: adapter.definition.skipReason ?? null,
      })),
      searchProviderCount: enabled.length,
    });

    if (enabled.length === 0) {
      throw new Error("Geen actieve zoekproviders. Configureer minimaal één search API key.");
    }

    const ordered = pickFastestProvider(enabled);
    const fallbacksAttempted: string[] = [];
    let lastError: Error | null = null;

    for (let index = 0; index < ordered.length; index += 1) {
      const adapter = ordered[index]!;
      const provider = adapter.definition;

      try {
        const execution = await executeWithResilience(
          {
            providerId: provider.id,
            timeoutMs: provider.timeoutMs,
            maxRetries: provider.maxRetries,
            rateLimitPerMinute: provider.rateLimitPerMinute,
            cacheKey: `${query}:${maxResults}`,
            useCache: provider.cacheEnabled,
            cacheTtlMs: provider.cacheTtlMs,
          },
          () => adapter.executeSearch!(query, maxResults),
        );

        if (execution.data.length === 0) {
          fallbacksAttempted.push(provider.id);
          lastError = new Error(`${provider.name} retourneerde 0 resultaten`);
          continue;
        }

        pipelineDebug("search.chain.success", {
          providerId: provider.id,
          count: execution.data.length,
          fallbacksAttempted,
        });

        return {
          results: execution.data,
          meta: {
            providerId: provider.id,
            durationMs: execution.durationMs,
            responseSize: execution.responseSize,
            fromCache: execution.fromCache,
            attempt: execution.attempt,
            fallbackUsed: index > 0,
            fallbacksAttempted,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        fallbacksAttempted.push(provider.id);
        lastError = error instanceof Error ? error : new Error(message);
        pipelineWarn("search.chain.fallback", { providerId: provider.id, message });
      }
    }

    throw lastError ?? new Error("Alle zoekproviders zijn mislukt");
  }

  async executeCrawlChain(url: string): Promise<CrawlChainResult> {
    const enabled = this.registry
      .getByCategory("crawler")
      .filter((adapter) => adapter.definition.enabled && adapter.executeCrawl);

    const fallbacksAttempted: string[] = [];
    let lastError: Error | null = null;
    let jsEscalationNeeded = false;
    const ordered = pickFastestProvider(enabled);

    for (let index = 0; index < ordered.length; index += 1) {
      const adapter = ordered[index]!;
      const provider = adapter.definition;

      if (jsEscalationNeeded && provider.id !== "playwright") continue;

      try {
        const execution = await executeWithResilience(
          {
            providerId: provider.id,
            timeoutMs: provider.timeoutMs,
            maxRetries: provider.maxRetries,
            rateLimitPerMinute: provider.rateLimitPerMinute,
            cacheKey: url,
            useCache: provider.cacheEnabled,
            cacheTtlMs: provider.cacheTtlMs,
          },
          () => adapter.executeCrawl!(url),
        );

        if (shouldEscalateToPlaywright(execution.data.html) && provider.id !== "playwright") {
          jsEscalationNeeded = true;
          fallbacksAttempted.push(`${provider.id}:js-shell`);
          lastError = new Error("Pagina vereist JavaScript — Playwright wordt geprobeerd");
          continue;
        }

        if (!execution.data.html.trim()) {
          fallbacksAttempted.push(provider.id);
          lastError = new Error(`${provider.name} retourneerde lege HTML`);
          continue;
        }

        pipelineDebug("crawl.chain.success", { providerId: provider.id, url, fallbacksAttempted });

        return {
          result: execution.data,
          meta: {
            providerId: provider.id,
            durationMs: execution.durationMs,
            responseSize: execution.responseSize,
            fromCache: execution.fromCache,
            attempt: execution.attempt,
            fallbackUsed: index > 0 || fallbacksAttempted.length > 0,
            fallbacksAttempted,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        fallbacksAttempted.push(provider.id);
        lastError = error instanceof Error ? error : new Error(message);
        pipelineWarn("crawl.chain.fallback", { providerId: provider.id, message, url });
      }
    }

    throw lastError ?? new Error("Alle crawlers zijn mislukt");
  }

  async testProvider(providerId: string): Promise<ProviderTestResult> {
    const adapter = this.registry.get(providerId);

    if (!adapter) {
      return {
        providerId,
        success: false,
        durationMs: 0,
        responseSize: 0,
        message: "Provider niet gevonden",
        error: "Onbekende provider",
      };
    }

    if (!adapter.definition.enabled) {
      return {
        providerId,
        success: false,
        durationMs: 0,
        responseSize: 0,
        message: adapter.definition.skipReason ?? "Provider uitgeschakeld",
        error: adapter.definition.skipReason ?? "Uitgeschakeld",
      };
    }

    const result = await adapter.test();

    if (result.success) {
      recordProviderSuccess(providerId, result.durationMs);
    } else {
      recordProviderFailure(providerId, result.error ?? result.message, result.durationMs);
    }

    return result;
  }

  resetProviderCache(providerId?: string): void {
    clearProviderCache(providerId);
    resetProviderStats(providerId);
  }

  async refreshProviderHealth(providerId: string): Promise<ProviderHealthSnapshot[]> {
    await this.testProvider(providerId);
    return this.getAvailableProviders();
  }
}

export function createPipelineRunId(): string {
  return randomUUID();
}
