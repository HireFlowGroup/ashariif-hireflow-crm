import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import { hasAnySearchProvider } from "@/features/lead-intelligence/providers/manager/provider-config";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";

export type BraveSearchResult = {
  title: string;
  url: string;
  description: string;
};

export function isBraveSearchConfigured(): boolean {
  return hasAnySearchProvider();
}

export async function braveSearch(
  query: string,
  maxResults: number,
): Promise<BraveSearchResult[]> {
  pipelineDebug("brave.search.request", { query, maxResults });

  try {
    const chain = await getProviderManager().executeSearchChain(query, maxResults);
    pipelineDebug("brave.search.completed", {
      query,
      count: chain.results.length,
      providerId: chain.meta.providerId,
      fallbackUsed: chain.meta.fallbackUsed,
    });
    return chain.results;
  } catch (error) {
    pipelineWarn("brave.search.failed", {
      message: error instanceof Error ? error.message : "Onbekende fout",
    });
    return [];
  }
}
