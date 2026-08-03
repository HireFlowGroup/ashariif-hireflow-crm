/** Backward-compatible re-exports — definitions komen uit ProviderRegistry. */
export {
  DEFAULT_PROVIDER_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RATE_LIMIT,
  DEFAULT_CACHE_TTL_MS,
  getBraveSearchApiKey,
  getSerpApiKey,
  getTavilyApiKey,
  getGoogleCseConfig,
  getBingSearchApiKey,
  getFirecrawlApiKey,
  isPlaywrightEnabled,
} from "@/features/lead-intelligence/providers/manager/provider-env";

export {
  getActiveSearchProviders,
  getSearchProviderAvailability,
  hasActiveSearchProviders as hasAnySearchProvider,
  type SearchProviderAvailability,
} from "@/features/lead-intelligence/providers/manager/search-provider-availability";

import { getProviderManager } from "@/features/lead-intelligence/providers/manager/create-provider-manager";
import { getProviderRegistry } from "@/features/lead-intelligence/providers/manager/provider-registry";
import type { ManagedProviderDefinition } from "@/features/lead-intelligence/providers/manager/types";

function ensureRegistry(): void {
  getProviderManager();
}

export function getManagedProviderDefinitions(): ManagedProviderDefinition[] {
  ensureRegistry();
  return getProviderRegistry().getDefinitions();
}

export function getProviderDefinition(providerId: string): ManagedProviderDefinition | null {
  ensureRegistry();
  return getProviderRegistry().get(providerId)?.definition ?? null;
}

export function getSearchProviderDefinitions(): ManagedProviderDefinition[] {
  ensureRegistry();
  return getProviderRegistry()
    .getByCategory("search")
    .map((adapter) => adapter.definition);
}

export function getCrawlerProviderDefinitions(): ManagedProviderDefinition[] {
  ensureRegistry();
  return getProviderRegistry()
    .getByCategory("crawler")
    .map((adapter) => adapter.definition);
}

export function getDiscoveryProviderDefinitions(): ManagedProviderDefinition[] {
  ensureRegistry();
  return getProviderRegistry()
    .getByCategory("discovery")
    .map((adapter) => adapter.definition);
}
