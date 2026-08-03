import "server-only";

import type { CompanySearchCriteria, ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { buildSignalQuery } from "@/features/hiring-intelligence/providers/shared/search-signal.mapper";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import { withTimeout } from "@/features/lead-intelligence/config/providers.config";
import { createEmptyCandidate } from "@/features/lead-intelligence/providers/types";
import {
  cleanCompanyTitle,
  extractDomain,
  normalizeCompanyName,
} from "@/features/lead-intelligence/services/recruitment-normalize";

export async function runFastTavilyDiscovery(
  criteria: CompanySearchCriteria,
  options: { maxResults: number; timeoutMs: number },
): Promise<ExternalCompanyCandidate[]> {
  const query = buildSignalQuery(criteria, "bedrijf Nederland");
  const chain = await withTimeout(
    getProviderManager().executeSearchChain(query, options.maxResults),
    options.timeoutMs,
    "Tavily discovery",
  );

  const seen = new Set<string>();

  return chain.results
    .map((result) => {
      const name = cleanCompanyTitle(result.title);
      if (!name || name.length < 2) return null;

      const domain = extractDomain(result.url);
      const dedupeKey = domain ?? normalizeCompanyName(name);
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);

      return createEmptyCandidate({
        externalId: `tavily:fast:${dedupeKey}`,
        name,
        normalizedName: normalizeCompanyName(name),
        website: result.url.startsWith("http") ? result.url : null,
        domain,
        city: criteria.city ?? null,
        region: criteria.region ?? null,
        province: criteria.region ?? null,
        sector: criteria.sector ?? null,
        source: "tavily",
        sourceUrl: result.url,
        description: result.description,
        confidence: 0.65,
        vacancyCount: 0,
      });
    })
    .filter((candidate): candidate is ExternalCompanyCandidate => candidate !== null);
}
