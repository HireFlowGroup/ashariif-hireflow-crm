import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";

export type FirecrawlScrapeResult = {
  url: string;
  markdown: string;
  html: string;
  metadata: Record<string, unknown>;
};

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

export async function firecrawlScrape(url: string): Promise<FirecrawlScrapeResult | null> {
  pipelineDebug("firecrawl.scrape.request", { url });

  try {
    const chain = await getProviderManager().executeCrawlChain(url);
    pipelineDebug("firecrawl.scrape.completed", {
      url: chain.result.url,
      providerId: chain.meta.providerId,
      markdownLength: chain.result.markdown.length,
      fallbackUsed: chain.meta.fallbackUsed,
    });

    return {
      url: chain.result.url,
      markdown: chain.result.markdown,
      html: chain.result.html,
      metadata: chain.result.metadata,
    };
  } catch (error) {
    pipelineWarn("firecrawl.scrape.failed", {
      url,
      message: error instanceof Error ? error.message : "Onbekende fout",
    });
    return null;
  }
}
