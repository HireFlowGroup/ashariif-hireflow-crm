import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";

function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

/** Stable identity for vacancy-level dedupe across providers. */
export function discoveryVacancyIdentityKey(result: EnrichedDiscoveryResult): string | null {
  if (result.resultType !== "individual_vacancy" || !result.officialDomain) return null;
  const title = (result.vacancyTitle ?? result.title).toLowerCase().trim();
  if (!title) return null;
  return `vacancy:${result.officialDomain.toLowerCase()}:${title}`;
}

export function discoveryResultDedupeKey(result: EnrichedDiscoveryResult): string {
  const vacancyKey = discoveryVacancyIdentityKey(result);
  if (vacancyKey) return vacancyKey;

  const urlKey = canonicalUrl(result.url);
  if (result.resultType === "individual_vacancy" && urlKey) {
    return `vacancy-url:${urlKey}`;
  }

  if (result.officialDomain) {
    return `domain:${result.officialDomain.toLowerCase()}`;
  }

  return `url:${urlKey}`;
}

export function dedupeEnrichedDiscoveryResults(results: EnrichedDiscoveryResult[]): EnrichedDiscoveryResult[] {
  const seenKeys = new Set<string>();
  const seenUrls = new Set<string>();
  const deduped: EnrichedDiscoveryResult[] = [];

  for (const result of results) {
    const urlKey = canonicalUrl(result.url);
    if (urlKey && seenUrls.has(urlKey)) continue;

    const key = discoveryResultDedupeKey(result);
    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    if (urlKey) seenUrls.add(urlKey);
    deduped.push(result);
  }

  return deduped;
}

/** Merge provider batches — primary (Tavily) wins on duplicate identity. */
export function mergeEnrichedDiscoveryResults(
  primary: EnrichedDiscoveryResult[],
  secondary: EnrichedDiscoveryResult[],
): EnrichedDiscoveryResult[] {
  return dedupeEnrichedDiscoveryResults([...primary, ...secondary]);
}
