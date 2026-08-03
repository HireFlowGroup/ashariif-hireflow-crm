export const MANAGED_PROVIDER_IDS = [
  "tavily",
  "brave-search",
  "firecrawl",
  "serpapi",
  "google-cse",
  "bing-search",
  "openai",
] as const;

export type ManagedProviderId = (typeof MANAGED_PROVIDER_IDS)[number];

export type ProviderSecretField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
};

export type ManagedProviderDefinition = {
  id: ManagedProviderId;
  name: string;
  category: "search" | "crawler" | "ai";
  description: string;
  secretFields: ProviderSecretField[];
  envFallbackKeys: string[];
};

export const MANAGED_PROVIDERS: ManagedProviderDefinition[] = [
  {
    id: "tavily",
    name: "Tavily",
    category: "search",
    description: "Live web search via Tavily API",
    secretFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "tvly-…",
        required: true,
      },
    ],
    envFallbackKeys: ["TAVILY_API_KEY"],
  },
  {
    id: "brave-search",
    name: "Brave",
    category: "search",
    description: "Web search via Brave Search API",
    secretFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "BSA…",
        required: true,
      },
    ],
    envFallbackKeys: ["WEB_SEARCH_API_KEY", "BRAVE_SEARCH_API_KEY"],
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    category: "crawler",
    description: "Website crawling en content extractie",
    secretFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "fc-…",
        required: true,
      },
    ],
    envFallbackKeys: ["FIRECRAWL_API_KEY"],
  },
  {
    id: "serpapi",
    name: "SerpAPI",
    category: "search",
    description: "Google resultaten via SerpAPI",
    secretFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "…",
        required: true,
      },
    ],
    envFallbackKeys: ["SERPAPI_API_KEY"],
  },
  {
    id: "google-cse",
    name: "Google CSE",
    category: "search",
    description: "Google Custom Search Engine",
    secretFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "AIza…",
        required: true,
      },
      {
        key: "cx",
        label: "Search Engine ID (CX)",
        placeholder: "…",
        required: true,
      },
    ],
    envFallbackKeys: ["GOOGLE_CSE_API_KEY", "GOOGLE_CSE_CX"],
  },
  {
    id: "bing-search",
    name: "Bing",
    category: "search",
    description: "Microsoft Bing Web Search API",
    secretFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "…",
        required: true,
      },
    ],
    envFallbackKeys: ["BING_SEARCH_API_KEY"],
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    description: "GPT modellen voor AI-assistent, parsing en enrichment",
    secretFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-…",
        required: true,
      },
    ],
    envFallbackKeys: ["OPENAI_API_KEY"],
  },
];

export function getManagedProvider(id: string): ManagedProviderDefinition | undefined {
  return MANAGED_PROVIDERS.find((provider) => provider.id === id);
}

export function isManagedProviderId(id: string): id is ManagedProviderId {
  return MANAGED_PROVIDER_IDS.includes(id as ManagedProviderId);
}

export type ProviderSecrets = Record<string, string>;

export type ProviderConfigRecord = {
  id: string;
  organizationId: string;
  providerId: ManagedProviderId;
  enabled: boolean;
  secrets: ProviderSecrets;
  maskedPreview: string | null;
  secretFingerprint: string;
  updatedBy: string | null;
  updatedAt: string;
};

export type ProviderHealthRecord = {
  providerId: ManagedProviderId;
  status: "healthy" | "degraded" | "unhealthy" | "disabled";
  healthScore: number;
  requestsToday: number;
  successRate: number;
  avgResponseMs: number;
  quotaRemaining: number | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  updatedAt: string;
};

export type ProviderSettingsSnapshot = {
  id: ManagedProviderId;
  name: string;
  category: ManagedProviderDefinition["category"];
  description: string;
  secretFields: ProviderSecretField[];
  enabled: boolean;
  configured: boolean;
  secretSource: "vault" | "env" | "none";
  maskedPreview: string | null;
  status: ProviderHealthRecord["status"];
  healthScore: number;
  avgResponseMs: number;
  quotaRemaining: number | null;
  requestsToday: number;
  successRate: number;
  lastError: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};
