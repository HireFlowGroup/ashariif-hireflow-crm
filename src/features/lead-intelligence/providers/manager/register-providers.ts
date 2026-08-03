import {
  createCrawlerAdapter,
  createDiscoveryAdapter,
  createSearchAdapter,
} from "@/features/lead-intelligence/providers/manager/adapters/adapter-factories";
import { createOpenAiAdapter } from "@/features/lead-intelligence/providers/manager/adapters/openai-adapter";
import {
  buildProviderDefinition,
  getBraveSearchApiKey,
  getBingSearchApiKey,
  getFirecrawlApiKey,
  getGoogleCseConfig,
  getOpenAiApiKey,
  getSerpApiKey,
  getTavilyApiKey,
  isPlaywrightEnabled,
} from "@/features/lead-intelligence/providers/manager/provider-env";
import type { ProviderRegistry } from "@/features/lead-intelligence/providers/manager/provider-registry";

/** Registreert alle providers via factories — geen hardcoding in ProviderManager. */
export function registerAllProviderFactories(registry: ProviderRegistry): void {
  registry.registerFactory(() =>
    createSearchAdapter(
      buildProviderDefinition({
        id: "tavily",
        name: "Tavily",
        category: "search",
        fallbackPriority: 0,
        enabled: Boolean(getTavilyApiKey()),
        apiKeyPresent: Boolean(getTavilyApiKey()),
        apiKeyEnvVars: ["TAVILY_API_KEY"],
        skipReason: getTavilyApiKey() ? undefined : "TAVILY_API_KEY niet geconfigureerd",
        timeoutEnvKey: "TAVILY_TIMEOUT_MS",
        retriesEnvKey: "TAVILY_MAX_RETRIES",
        rateLimitEnvKey: "TAVILY_RATE_LIMIT",
      }),
      "tavily",
    ),
  );

  registry.registerFactory(() =>
    createSearchAdapter(
      buildProviderDefinition({
        id: "brave-search",
        name: "Brave Search",
        category: "search",
        fallbackPriority: 1,
        enabled: Boolean(getBraveSearchApiKey()),
        apiKeyPresent: Boolean(getBraveSearchApiKey()),
        apiKeyEnvVars: ["WEB_SEARCH_API_KEY", "BRAVE_SEARCH_API_KEY"],
        skipReason: getBraveSearchApiKey() ? undefined : "WEB_SEARCH_API_KEY niet geconfigureerd",
        timeoutEnvKey: "BRAVE_SEARCH_TIMEOUT_MS",
        retriesEnvKey: "BRAVE_SEARCH_MAX_RETRIES",
        rateLimitEnvKey: "BRAVE_SEARCH_RATE_LIMIT",
      }),
      "brave-search",
    ),
  );

  registry.registerFactory(() =>
    createSearchAdapter(
      buildProviderDefinition({
        id: "serpapi",
        name: "SerpAPI",
        category: "search",
        fallbackPriority: 2,
        enabled: Boolean(getSerpApiKey()),
        apiKeyPresent: Boolean(getSerpApiKey()),
        apiKeyEnvVars: ["SERPAPI_API_KEY"],
        skipReason: getSerpApiKey() ? undefined : "SERPAPI_API_KEY niet geconfigureerd",
        timeoutEnvKey: "SERPAPI_TIMEOUT_MS",
        retriesEnvKey: "SERPAPI_MAX_RETRIES",
        rateLimitEnvKey: "SERPAPI_RATE_LIMIT",
      }),
      "serpapi",
    ),
  );

  registry.registerFactory(() =>
    createSearchAdapter(
      buildProviderDefinition({
        id: "google-cse",
        name: "Google Custom Search",
        category: "search",
        fallbackPriority: 3,
        enabled: Boolean(getGoogleCseConfig()),
        apiKeyPresent: Boolean(getGoogleCseConfig()),
        apiKeyEnvVars: ["GOOGLE_CSE_API_KEY", "GOOGLE_CSE_CX"],
        skipReason: getGoogleCseConfig() ? undefined : "GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX vereist",
        timeoutEnvKey: "GOOGLE_CSE_TIMEOUT_MS",
        retriesEnvKey: "GOOGLE_CSE_MAX_RETRIES",
        rateLimitEnvKey: "GOOGLE_CSE_RATE_LIMIT",
      }),
      "google-cse",
    ),
  );

  registry.registerFactory(() =>
    createSearchAdapter(
      buildProviderDefinition({
        id: "bing-search",
        name: "Bing Search",
        category: "search",
        fallbackPriority: 4,
        enabled: Boolean(getBingSearchApiKey()),
        apiKeyPresent: Boolean(getBingSearchApiKey()),
        apiKeyEnvVars: ["BING_SEARCH_API_KEY"],
        skipReason: getBingSearchApiKey() ? undefined : "BING_SEARCH_API_KEY niet geconfigureerd",
        timeoutEnvKey: "BING_SEARCH_TIMEOUT_MS",
        retriesEnvKey: "BING_SEARCH_MAX_RETRIES",
        rateLimitEnvKey: "BING_SEARCH_RATE_LIMIT",
      }),
      "bing-search",
    ),
  );

  registry.registerFactory(() =>
    createCrawlerAdapter(
      buildProviderDefinition({
        id: "firecrawl",
        name: "Firecrawl",
        category: "crawler",
        fallbackPriority: 5,
        enabled: Boolean(getFirecrawlApiKey()),
        apiKeyPresent: Boolean(getFirecrawlApiKey()),
        apiKeyEnvVars: ["FIRECRAWL_API_KEY"],
        skipReason: getFirecrawlApiKey() ? undefined : "FIRECRAWL_API_KEY niet geconfigureerd",
        timeoutEnvKey: "FIRECRAWL_TIMEOUT_MS",
        timeoutFallback: 25_000,
        retriesEnvKey: "FIRECRAWL_MAX_RETRIES",
        rateLimitEnvKey: "FIRECRAWL_RATE_LIMIT",
        rateLimitFallback: 30,
      }),
    ),
  );

  registry.registerFactory(() =>
    createCrawlerAdapter(
      buildProviderDefinition({
        id: "native-fetch",
        name: "Native Fetch",
        category: "crawler",
        fallbackPriority: 6,
        enabled: true,
        apiKeyPresent: true,
        apiKeyEnvVars: [],
        timeoutEnvKey: "HTTP_FETCH_TIMEOUT_MS",
        retriesEnvKey: "HTTP_FETCH_MAX_RETRIES",
        rateLimitEnvKey: "HTTP_FETCH_RATE_LIMIT",
        rateLimitFallback: 120,
      }),
      "http-fetch",
    ),
  );

  registry.registerFactory(() =>
    createCrawlerAdapter(
      buildProviderDefinition({
        id: "native-crawler",
        name: "Native Crawler",
        category: "crawler",
        fallbackPriority: 7,
        enabled: true,
        apiKeyPresent: true,
        apiKeyEnvVars: [],
        timeoutEnvKey: "NATIVE_CRAWLER_TIMEOUT_MS",
        timeoutFallback: 15_000,
        retriesEnvKey: "NATIVE_CRAWLER_MAX_RETRIES",
        rateLimitEnvKey: "NATIVE_CRAWLER_RATE_LIMIT",
        rateLimitFallback: 120,
      }),
    ),
  );

  registry.registerFactory(() =>
    createCrawlerAdapter(
      buildProviderDefinition({
        id: "playwright",
        name: "Playwright",
        category: "crawler",
        fallbackPriority: 8,
        enabled: isPlaywrightEnabled(),
        apiKeyPresent: isPlaywrightEnabled(),
        apiKeyEnvVars: ["PLAYWRIGHT_CRAWLER_ENABLED"],
        skipReason: isPlaywrightEnabled() ? undefined : "PLAYWRIGHT_CRAWLER_ENABLED=true vereist",
        timeoutEnvKey: "PLAYWRIGHT_TIMEOUT_MS",
        timeoutFallback: 45_000,
        retriesEnvKey: "PLAYWRIGHT_MAX_RETRIES",
        rateLimitEnvKey: "PLAYWRIGHT_RATE_LIMIT",
        rateLimitFallback: 10,
        cacheEnabled: false,
      }),
    ),
  );

  const searchAdapters = () =>
    registry
      .getByCategory("search")
      .filter((adapter) => adapter.definition.enabled && adapter.executeSearch);

  function delegateToSearchChain(query: string, maxResults: number) {
    const enabledSearchProviders = searchAdapters();

    for (const adapter of enabledSearchProviders) {
      return adapter.executeSearch!(query, maxResults);
    }

    throw new Error("Geen actieve search backend voor discovery provider");
  }

  registry.registerFactory(() => {
    const definition = buildProviderDefinition({
      id: "indeed",
      name: "Indeed",
      category: "discovery",
      fallbackPriority: 10,
      enabled: true,
      apiKeyPresent: true,
      apiKeyEnvVars: ["TAVILY_API_KEY", "WEB_SEARCH_API_KEY", "SERPAPI_API_KEY", "GOOGLE_CSE_API_KEY", "BING_SEARCH_API_KEY"],
      requiresBackend: ["search"],
      rateLimitFallback: 30,
    });

    return createDiscoveryAdapter(
      definition,
      (seed) => `${seed} site:indeed.nl vacature`,
      delegateToSearchChain,
    );
  });

  registry.registerFactory(() => {
    const definition = buildProviderDefinition({
      id: "google-maps",
      name: "Google Maps",
      category: "discovery",
      fallbackPriority: 11,
      enabled: true,
      apiKeyPresent: true,
      apiKeyEnvVars: ["TAVILY_API_KEY", "WEB_SEARCH_API_KEY", "SERPAPI_API_KEY", "GOOGLE_CSE_API_KEY", "BING_SEARCH_API_KEY"],
      requiresBackend: ["search"],
      rateLimitFallback: 30,
    });

    return createDiscoveryAdapter(
      definition,
      (seed) => `${seed} site:google.com/maps bedrijf`,
      delegateToSearchChain,
    );
  });

  registry.registerFactory(() => {
    const definition = buildProviderDefinition({
      id: "werkenbij",
      name: "Werkenbij",
      category: "discovery",
      fallbackPriority: 12,
      enabled: true,
      apiKeyPresent: true,
      apiKeyEnvVars: ["TAVILY_API_KEY", "WEB_SEARCH_API_KEY", "SERPAPI_API_KEY", "GOOGLE_CSE_API_KEY", "BING_SEARCH_API_KEY"],
      requiresBackend: ["search"],
      rateLimitFallback: 30,
    });

    return createDiscoveryAdapter(
      definition,
      (seed) => `${seed} "werken bij" OR werkenbij vacatures`,
      delegateToSearchChain,
    );
  });

  registry.registerFactory(() => {
    const openAiKeyPresent = Boolean(getOpenAiApiKey());

    const definition = buildProviderDefinition({
      id: "openai",
      name: "OpenAI",
      category: "ai",
      fallbackPriority: 20,
      enabled: openAiKeyPresent,
      apiKeyPresent: openAiKeyPresent,
      apiKeyEnvVars: ["OPENAI_API_KEY"],
      skipReason: openAiKeyPresent ? undefined : "OpenAI API key niet geconfigureerd",
      timeoutEnvKey: "OPENAI_TIMEOUT_MS",
      timeoutFallback: 15_000,
      cacheEnabled: false,
    });

    return createOpenAiAdapter(definition);
  });
}
