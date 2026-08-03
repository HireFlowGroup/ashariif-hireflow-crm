import { braveSearch, isBraveSearchConfigured } from "@/features/lead-intelligence/clients/brave-search.client";
import { hasAnySearchProvider } from "@/features/lead-intelligence/providers/manager/provider-config";
import type { CompanySearchCriteria, ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";
import {
  braveResultToCandidate,
  buildDiscoveryQuery,
  vacancyResultToCandidate,
} from "@/features/lead-intelligence/providers/discovery/brave-candidate-mapper";
import type { RecruitmentDiscoveryProvider } from "@/features/lead-intelligence/providers/pipeline/types";

type ResultMapper = (
  result: Awaited<ReturnType<typeof braveSearch>>[number],
  criteria: CompanySearchCriteria,
) => ExternalCompanyCandidate | null;

function createBraveDiscoveryProvider(config: {
  id: string;
  displayName: string;
  order: number;
  source: string;
  querySuffix: string;
  confidence: number;
  mapResult?: ResultMapper;
}): RecruitmentDiscoveryProvider {
  return {
    id: config.id,
    displayName: config.displayName,
    order: config.order,
    get enabled() {
      return isBraveSearchConfigured() && hasAnySearchProvider("brave-discovery.providers");
    },
    get skipReason() {
      return this.enabled
        ? undefined
        : "Geen zoekprovider geconfigureerd (Tavily/Brave/SerpAPI/Google/Bing)";
    },

    async discover(criteria, context) {
      pipelineDebug(`discovery.${config.id}.started`, { order: config.order });

      const query = buildDiscoveryQuery(criteria, config.querySuffix);

      if (!query) {
        return [];
      }

      const results = await braveSearch(query, context.maxResults);
      const mapper: ResultMapper =
        config.mapResult ??
        ((result, crit) => braveResultToCandidate(result, config.source, crit, config.confidence));

      return results
        .map((result) => mapper(result, criteria))
        .filter((candidate): candidate is ExternalCompanyCandidate => candidate !== null);
    },
  };
}

/** 1. Google Search equivalent — Brave web search for companies */
export const braveWebSearchProvider = createBraveDiscoveryProvider({
  id: "brave-web-search",
  displayName: "Google Search (Brave)",
  order: 1,
  source: "brave-web-search",
  querySuffix: "bedrijf Nederland",
  confidence: 0.65,
});

/** 2. Google Maps equivalent — local business discovery */
export const braveGoogleMapsProvider = createBraveDiscoveryProvider({
  id: "brave-google-maps",
  displayName: "Google Maps (Brave)",
  order: 2,
  source: "brave-google-maps",
  querySuffix: "site:google.com/maps bedrijf",
  confidence: 0.7,
});

/** 6. Indeed vacancy discovery */
export const braveIndeedProvider = createBraveDiscoveryProvider({
  id: "brave-indeed",
  displayName: "Indeed",
  order: 6,
  source: "indeed",
  querySuffix: "site:indeed.nl vacature",
  confidence: 0.6,
  mapResult: (result, criteria) => vacancyResultToCandidate(result, "indeed", criteria),
});

/** 7. Nationale Vacaturebank */
export const braveNationaleVacaturebankProvider = createBraveDiscoveryProvider({
  id: "brave-nationale-vacaturebank",
  displayName: "Nationale Vacaturebank",
  order: 7,
  source: "nationale-vacaturebank",
  querySuffix: "site:nationalevacaturebank.nl vacature",
  confidence: 0.6,
  mapResult: (result, criteria) =>
    vacancyResultToCandidate(result, "nationale-vacaturebank", criteria),
});

/** 8. Werken-bij sites */
export const braveWerkenBijProvider = createBraveDiscoveryProvider({
  id: "brave-werkenbij",
  displayName: "Werken-bij sites",
  order: 8,
  source: "werkenbij",
  querySuffix: '"werken bij" OR werkenbij vacatures',
  confidence: 0.55,
});
