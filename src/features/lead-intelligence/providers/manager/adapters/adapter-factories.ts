import type { ProviderAdapter } from "@/features/lead-intelligence/providers/manager/provider-adapter.types";
import type { ManagedProviderDefinition, ProviderTestResult } from "@/features/lead-intelligence/providers/manager/types";
import { runCrawlerProvider } from "@/features/lead-intelligence/providers/manager/crawler-providers";
import { runSearchProvider } from "@/features/lead-intelligence/providers/manager/search-providers";

export function createSearchAdapter(
  definition: ManagedProviderDefinition,
  executorId: string,
): ProviderAdapter {
  return {
    definition,
    async test(): Promise<ProviderTestResult> {
      const started = Date.now();
      try {
        const result = await runSearchProvider(
          { ...definition, id: executorId },
          "HireFlow provider health check",
          1,
        );
        return {
          providerId: definition.id,
          success: result.data.length > 0,
          durationMs: Date.now() - started,
          responseSize: result.responseSize,
          message: `${result.data.length} resultaat via ${definition.name}`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        return {
          providerId: definition.id,
          success: false,
          durationMs: Date.now() - started,
          responseSize: 0,
          message: `Test mislukt: ${message}`,
          error: message,
        };
      }
    },
    async executeSearch(query, maxResults) {
      const result = await runSearchProvider({ ...definition, id: executorId }, query, maxResults);
      return {
        data: result.data,
        responseSize: result.responseSize,
        quotaRemaining: result.quotaRemaining ?? null,
      };
    },
  };
}

export function createCrawlerAdapter(
  definition: ManagedProviderDefinition,
  executorId?: string,
): ProviderAdapter {
  const id = executorId ?? definition.id;

  return {
    definition,
    async test(): Promise<ProviderTestResult> {
      const started = Date.now();
      try {
        const result = await runCrawlerProvider({ ...definition, id }, "https://example.com");
        return {
          providerId: definition.id,
          success: Boolean(result.data.html),
          durationMs: Date.now() - started,
          responseSize: result.responseSize,
          message: `Crawl gelukt via ${definition.name}`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        return {
          providerId: definition.id,
          success: false,
          durationMs: Date.now() - started,
          responseSize: 0,
          message: `Test mislukt: ${message}`,
          error: message,
        };
      }
    },
    async executeCrawl(url) {
      const result = await runCrawlerProvider({ ...definition, id }, url);
      return {
        data: result.data,
        responseSize: result.responseSize,
        quotaRemaining: result.quotaRemaining ?? null,
      };
    },
  };
}

export function createDiscoveryAdapter(
  definition: ManagedProviderDefinition,
  buildQuery: (seed: string) => string,
  searchDelegate: (query: string, maxResults: number) => ReturnType<NonNullable<ProviderAdapter["executeSearch"]>>,
): ProviderAdapter {
  return {
    definition,
    async test(): Promise<ProviderTestResult> {
      const started = Date.now();
      try {
        if (!searchDelegate) {
          throw new Error("Geen search backend beschikbaar");
        }
        const result = await searchDelegate(buildQuery("HireFlow"), 1);
        return {
          providerId: definition.id,
          success: result.data.length > 0,
          durationMs: Date.now() - started,
          responseSize: result.responseSize,
          message: `${result.data.length} discovery resultaat`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        return {
          providerId: definition.id,
          success: false,
          durationMs: Date.now() - started,
          responseSize: 0,
          message: `Test mislukt: ${message}`,
          error: message,
        };
      }
    },
    async executeSearch(query, maxResults) {
      const result = await searchDelegate(buildQuery(query), maxResults);
      return result;
    },
  };
}
