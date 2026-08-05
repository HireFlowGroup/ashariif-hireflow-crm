import "server-only";

import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import type { TavilyDiscoveryResult } from "@/features/company-finder/discovery/discovery-quality-gate";
import { buildSignalQuery } from "@/features/hiring-intelligence/providers/shared/search-signal.mapper";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import { withTimeout } from "@/features/lead-intelligence/config/providers.config";

export async function runFastTavilySearch(
  criteria: CompanySearchCriteria,
  options: { maxResults: number; timeoutMs: number },
): Promise<{ results: TavilyDiscoveryResult[]; providerId: string }> {
  const query = buildSignalQuery(criteria, "recruitment opdracht vacature hiring behoefte Nederland");
  const chain = await withTimeout(
    getProviderManager().executeSearchChain(query, options.maxResults),
    options.timeoutMs,
    "Tavily discovery",
  );

  return {
    results: chain.results.map((result) => ({
      title: result.title,
      url: result.url,
      description: result.description ?? null,
    })),
    providerId: chain.meta?.providerId ?? "tavily",
  };
}
