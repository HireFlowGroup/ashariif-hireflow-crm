export const DISCOVERY_SEARCH_PROVIDER_PRIORITY = [
  "tavily",
  "brave-search",
  "google-cse",
  "bing-search",
  "serpapi",
  "exa",
  "openai-web-search",
] as const;

export type DiscoverySearchProviderId = (typeof DISCOVERY_SEARCH_PROVIDER_PRIORITY)[number];

/** AI Recruiter discovery: Tavily primary, SerpAPI controlled fallback (no unrelated providers). */
export const DISCOVERY_AI_RECRUITER_FAILOVER_PRIORITY = [
  "tavily",
  "serpapi",
] as const satisfies readonly DiscoverySearchProviderId[];

export type DiscoveryProviderSkipReason =
  | "missing_api_key"
  | "not_configured"
  | "quota_exceeded"
  | "timeout"
  | "network_error"
  | "http_401"
  | "http_403"
  | "http_429"
  | "empty_results"
  | "no_executor"
  | "unknown_error";

export type DiscoveryProviderDebugEntry = {
  providerId: DiscoverySearchProviderId;
  name: string;
  configured: boolean;
  started: boolean;
  success: boolean;
  skipped: boolean;
  skipReason: DiscoveryProviderSkipReason | string | null;
  resultCount: number;
  durationMs: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  queryCount?: number;
  /** True when an outbound HTTP call was attempted (not cache / pre-skip). */
  httpInvoked?: boolean;
  cacheHit?: boolean;
  budgetBlocked?: boolean;
};

export type DiscoverySearchFailoverResult = {
  results: Array<{
    title: string;
    url: string;
    description: string;
    providerId: string;
  }>;
  providerRuns: DiscoveryProviderDebugEntry[];
  successfulProviderIds: string[];
  allProvidersSkipped: boolean;
};

export const DISCOVERY_ALL_PROVIDERS_FAILED_MESSAGE =
  "Geen werkende searchprovider beschikbaar.";

export type DiscoverySearchFailoverOptions = {
  /** Stop after the first provider that returns ≥1 result (cost control). */
  stopOnFirstSuccess?: boolean;
  /** Max configured providers to invoke per query (excluding missing-key skips). */
  maxProviderAttempts?: number;
  /** Providers skipped for remainder of run (e.g. Tavily quota exhausted). */
  skipProviderIds?: ReadonlySet<DiscoverySearchProviderId>;
  /** Per-run HTTP attempt budget (P0-R3.2.2). */
  apiBudget?: import("@/features/company-finder/discovery/discovery-run-api-budget.service").DiscoveryRunApiBudget;
  /** Override failover order (e.g. SerpAPI-only when Tavily is budget-skipped). */
  providerPriority?: readonly DiscoverySearchProviderId[];
};