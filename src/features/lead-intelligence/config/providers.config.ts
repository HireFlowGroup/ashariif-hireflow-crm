/** Lead Intelligence / Recruitment provider configuration from environment variables. */

export type ProviderConfig = {
  name: string;
  enabled: boolean;
  apiKey: string | null;
  reason?: string;
};

export function getLeadIntelligenceConfig() {
  const braveKey =
    process.env.WEB_SEARCH_API_KEY?.trim() ||
    process.env.BRAVE_SEARCH_API_KEY?.trim() ||
    null;

  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim() || null;

  return {
    maxResults: parseInt(process.env.COMPANY_FINDER_MAX_RESULTS ?? "50", 10),
    providerTimeoutMs: parseInt(
      process.env.COMPANY_FINDER_PROVIDER_TIMEOUT_MS ?? "20000",
      10,
    ),
    discoveryConcurrency: parseInt(process.env.COMPANY_FINDER_DISCOVERY_CONCURRENCY ?? "4", 10),
    discoveryMaxResultsPerProvider: parseInt(
      process.env.COMPANY_FINDER_DISCOVERY_MAX_RESULTS_PER_PROVIDER ?? "8",
      10,
    ),
    discoveryTimeoutMs: parseInt(process.env.COMPANY_FINDER_DISCOVERY_TIMEOUT_MS ?? "12000", 10),
    discoveryIngestConcurrency: parseInt(
      process.env.COMPANY_FINDER_DISCOVERY_INGEST_CONCURRENCY ?? "6",
      10,
    ),
    enrichmentConcurrency: parseInt(
      process.env.COMPANY_FINDER_ENRICHMENT_CONCURRENCY ?? "5",
      10,
    ),
    tavilyTimeoutMs: parseInt(process.env.COMPANY_FINDER_TAVILY_TIMEOUT_MS ?? "10000", 10),
    crawlerTimeoutMs: parseInt(process.env.COMPANY_FINDER_CRAWLER_TIMEOUT_MS ?? "8000", 10),
    aiTimeoutMs: parseInt(process.env.COMPANY_FINDER_AI_TIMEOUT_MS ?? "12000", 10),
    companyProcessingConcurrency: parseInt(
      process.env.COMPANY_FINDER_COMPANY_PROCESSING_CONCURRENCY ?? "5",
      10,
    ),
    globalJobTimeoutMs: parseInt(process.env.COMPANY_FINDER_GLOBAL_JOB_TIMEOUT_MS ?? "45000", 10),
    fastModeMaxResults: parseInt(process.env.COMPANY_FINDER_FAST_MODE_MAX_RESULTS ?? "15", 10),
    braveSearch: {
      name: "brave-search",
      enabled: Boolean(braveKey),
      apiKey: braveKey,
      reason: braveKey ? undefined : "WEB_SEARCH_API_KEY niet geconfigureerd",
    },
    firecrawl: {
      name: "firecrawl",
      enabled: Boolean(firecrawlKey),
      apiKey: firecrawlKey,
      reason: firecrawlKey ? undefined : "FIRECRAWL_API_KEY niet geconfigureerd",
    },
    websiteCrawler: resolveProvider("website-crawler", "public", true),
  };
}

function resolveProvider(
  name: string,
  key: string | undefined | null,
  optional: boolean,
  missingReason?: string,
): ProviderConfig {
  const apiKey = key?.trim() || null;

  if (!apiKey && !optional) {
    return {
      name,
      enabled: false,
      apiKey: null,
      reason: missingReason ?? "Geen API-key geconfigureerd",
    };
  }

  return { name, enabled: true, apiKey };
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: time-out na ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 500,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
