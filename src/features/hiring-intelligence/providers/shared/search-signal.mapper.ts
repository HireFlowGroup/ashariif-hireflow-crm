import type { BraveSearchResult } from "@/features/lead-intelligence/clients/brave-search.client";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import type {
  CollectSignalsCriteria,
  IncomingHiringSignal,
} from "@/features/hiring-intelligence/domain/signal-types";
import type { HiringSignalProviderId } from "@/features/hiring-intelligence/domain/signal-types";
import {
  cleanCompanyTitle,
  extractDomain,
  normalizeCompanyName,
} from "@/features/lead-intelligence/services/recruitment-normalize";
import {
  detectSignalTypeFromContent,
  enrichIncomingSignal,
} from "@/features/hiring-intelligence/services/signal-scoring";
import { getDefaultConfidence, type HiringSignalType } from "@/features/hiring-intelligence/domain/signal-types";

export function buildSignalQuery(criteria: CollectSignalsCriteria, suffix: string): string {
  const vacancyPart = criteria.vacancyTitles?.join(" ");

  return [
    criteria.companyName,
    criteria.sector,
    criteria.keywords,
    vacancyPart,
    criteria.city,
    criteria.region,
    suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export async function searchForSignals(
  query: string,
  maxResults: number,
): Promise<BraveSearchResult[]> {
  if (!query) return [];
  const chain = await getProviderManager().executeSearchChain(query, maxResults);
  return chain.results;
}

type MapSearchResultOptions = {
  provider: HiringSignalProviderId;
  source: string;
  defaultType: HiringSignalType;
  criteria: CollectSignalsCriteria;
  mapType?: (result: BraveSearchResult) => HiringSignalType | null;
};

export function mapSearchResultToSignal(
  result: BraveSearchResult,
  options: MapSearchResultOptions,
): IncomingHiringSignal | null {
  const title = cleanCompanyTitle(result.title);
  if (!title || title.length < 2) return null;
  if (shouldSkipUrl(result.url)) return null;

  const type =
    options.mapType?.(result) ??
    detectSignalTypeFromContent(title, result.description, result.url) ??
    options.defaultType;

  const domain = result.url.startsWith("http") ? extractDomain(result.url) : null;
  const companyName = extractCompanyName(title, result.description, type);

  return enrichIncomingSignal(
    {
      type,
      title,
      description: result.description || title,
      url: result.url,
      source: options.source,
      provider: options.provider,
      confidence: getDefaultConfidence(type),
      importance: 0,
      aiRelevance: 0,
      externalId: `${options.provider}:${domain ?? normalizeCompanyName(companyName ?? title)}`,
      companyHint: companyName
        ? {
            name: companyName,
            normalizedName: normalizeCompanyName(companyName),
            website: result.url.startsWith("http") ? result.url : null,
            domain,
            city: options.criteria.city ?? null,
            region: options.criteria.region ?? null,
            sector: options.criteria.sector ?? null,
          }
        : null,
      extractedFields: {
        name: companyName ?? title,
        website: result.url.startsWith("http") ? result.url : undefined,
        domain: domain ?? undefined,
        city: options.criteria.city,
        region: options.criteria.region,
        sector: options.criteria.sector,
        source: options.source,
      },
      payload: { raw: result },
    },
    options.criteria,
  );
}

function shouldSkipUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return ["facebook.com", "instagram.com", "twitter.com", "wikipedia.org", "youtube.com"].some(
    (host) => lower.includes(host),
  );
}

function extractCompanyName(title: string, description: string, type: HiringSignalType): string | null {
  if (type === "indeed_vacancy" || type === "vacancy") {
    const match = title.match(/(?:bij|at|@)\s+(.+?)(?:\s*[|\-–—]|$)/i);
    if (match?.[1]) return cleanCompanyTitle(match[1]);
  }
  return cleanCompanyTitle(title);
}

export function createSearchSignalProvider(config: {
  id: string;
  displayName: string;
  order: number;
  provider: HiringSignalProviderId;
  source: string;
  querySuffix: string;
  defaultType: HiringSignalType;
  enabled: boolean;
  skipReason?: string;
  mapType?: (result: BraveSearchResult) => HiringSignalType | null;
}): import("@/features/hiring-intelligence/providers/types").HiringSignalProvider {
  return {
    id: config.id,
    displayName: config.displayName,
    order: config.order,
    enabled: config.enabled,
    skipReason: config.skipReason,

    async collectSignals(criteria, context) {
      const query = buildSignalQuery(criteria, config.querySuffix);
      const perProviderLimit = context.maxResultsPerProvider ?? Math.min(context.maxResults, 8);
      const results = await searchForSignals(query, perProviderLimit);

      return results
        .map((result) =>
          mapSearchResultToSignal(result, {
            provider: config.provider,
            source: config.source,
            defaultType: config.defaultType,
            criteria,
            mapType: config.mapType,
          }),
        )
        .filter((signal): signal is IncomingHiringSignal => signal !== null);
    },
  };
}
