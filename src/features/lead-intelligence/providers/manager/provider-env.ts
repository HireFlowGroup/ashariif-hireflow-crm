import "server-only";

import type { ManagedProviderDefinition, ProviderCategory } from "@/features/lead-intelligence/providers/manager/types";
import { getActiveOrganizationId } from "@/features/provider-vault/server/org-context";
import {
  getOrgProviderCredentials,
  getOrgProviderSecret,
} from "@/features/provider-vault/server/credential-cache.service";
import type { ManagedProviderId } from "@/features/provider-vault/shared/domain/provider-definitions";

export const DEFAULT_PROVIDER_TIMEOUT_MS = parseInt(
  process.env.COMPANY_FINDER_PROVIDER_TIMEOUT_MS ?? "20000",
  10,
);
export const DEFAULT_MAX_RETRIES = parseInt(process.env.PROVIDER_MAX_RETRIES ?? "2", 10);
export const DEFAULT_RATE_LIMIT = parseInt(process.env.PROVIDER_RATE_LIMIT_PER_MINUTE ?? "60", 10);
export const DEFAULT_CACHE_TTL_MS = parseInt(process.env.PROVIDER_CACHE_TTL_MS ?? "300000", 10);

function envInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

export function firstEnvKey(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function resolveVaultOrEnv(
  providerId: ManagedProviderId,
  field: string,
  ...envKeys: string[]
): string | null {
  const orgId = getActiveOrganizationId();

  if (orgId) {
    const entry = getOrgProviderCredentials(orgId, providerId);
    if (entry && !entry.enabled) {
      return null;
    }
  }

  const vaultValue = getOrgProviderSecret(orgId, providerId, field);
  if (vaultValue) return vaultValue;
  return firstEnvKey(...envKeys);
}

type BuildDefinitionInput = {
  id: string;
  name: string;
  category: ProviderCategory;
  fallbackPriority: number;
  enabled: boolean;
  apiKeyPresent: boolean;
  apiKeyEnvVars: string[];
  skipReason?: string;
  timeoutEnvKey?: string;
  timeoutFallback?: number;
  retriesEnvKey?: string;
  rateLimitEnvKey?: string;
  rateLimitFallback?: number;
  cacheEnabled?: boolean;
  requiresBackend?: string[];
};

export function buildProviderDefinition(input: BuildDefinitionInput): ManagedProviderDefinition {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    priority: input.fallbackPriority,
    fallbackPriority: input.fallbackPriority,
    enabled: input.enabled,
    apiKeyPresent: input.apiKeyPresent,
    apiKeyEnvVars: input.apiKeyEnvVars,
    skipReason: input.skipReason,
    timeoutMs: envInt(input.timeoutEnvKey ?? "COMPANY_FINDER_PROVIDER_TIMEOUT_MS", input.timeoutFallback ?? DEFAULT_PROVIDER_TIMEOUT_MS),
    maxRetries: envInt(input.retriesEnvKey ?? "PROVIDER_MAX_RETRIES", DEFAULT_MAX_RETRIES),
    rateLimitPerMinute: envInt(
      input.rateLimitEnvKey ?? "PROVIDER_RATE_LIMIT_PER_MINUTE",
      input.rateLimitFallback ?? DEFAULT_RATE_LIMIT,
    ),
    cacheEnabled: input.cacheEnabled ?? true,
    cacheTtlMs: envInt("PROVIDER_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS),
    requiresBackend: input.requiresBackend,
  };
}

export function isPlaywrightEnabled(): boolean {
  return envBool("PLAYWRIGHT_CRAWLER_ENABLED", false);
}

export function getTavilyApiKey(): string | null {
  return resolveVaultOrEnv("tavily", "apiKey", "TAVILY_API_KEY");
}

export function getBraveSearchApiKey(): string | null {
  return resolveVaultOrEnv("brave-search", "apiKey", "WEB_SEARCH_API_KEY", "BRAVE_SEARCH_API_KEY");
}

export function getSerpApiKey(): string | null {
  return resolveVaultOrEnv("serpapi", "apiKey", "SERPAPI_API_KEY");
}

export function getGoogleCseConfig(): { apiKey: string; cx: string } | null {
  const apiKey = resolveVaultOrEnv("google-cse", "apiKey", "GOOGLE_CSE_API_KEY");
  const cx = resolveVaultOrEnv("google-cse", "cx", "GOOGLE_CSE_CX");
  if (!apiKey || !cx) return null;
  return { apiKey, cx };
}

export function getBingSearchApiKey(): string | null {
  return resolveVaultOrEnv("bing-search", "apiKey", "BING_SEARCH_API_KEY");
}

export function getFirecrawlApiKey(): string | null {
  return resolveVaultOrEnv("firecrawl", "apiKey", "FIRECRAWL_API_KEY");
}

export function getOpenAiApiKey(): string | null {
  return resolveVaultOrEnv("openai", "apiKey", "OPENAI_API_KEY");
}

export function parseQuotaFromHeaders(headers: Headers): number | null {
  const candidates = [
    "x-ratelimit-remaining",
    "x-rate-limit-remaining",
    "ratelimit-remaining",
  ];

  for (const name of candidates) {
    const value = headers.get(name);
    if (value) {
      const parsed = parseInt(value, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}
