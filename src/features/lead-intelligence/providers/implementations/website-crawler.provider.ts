import { getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";
import type { CompanySearchProvider } from "@/features/lead-intelligence/providers/types";

/**
 * Website crawler is an enrichment provider, not a search provider.
 * Registered here as a no-op search provider for registry completeness.
 * Actual crawling happens in the enrichment phase.
 */
export function createWebsiteCrawlerSearchProvider(): CompanySearchProvider {
  const config = getLeadIntelligenceConfig();

  return {
    name: "website-crawler",
    enabled: config.websiteCrawler.enabled,

    async search() {
      return [];
    },
  };
}

export { enrichFromWebsite as crawlAndEnrich } from "@/features/lead-intelligence/services/enrichment";
