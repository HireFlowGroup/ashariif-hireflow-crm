import "server-only";

import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";
import {
  getBingSearchApiKey,
  getBraveSearchApiKey,
  getGoogleCseConfig,
  getSerpApiKey,
  getTavilyApiKey,
} from "@/features/lead-intelligence/providers/manager/provider-env";
import { getProviderRuntimeStats } from "@/features/lead-intelligence/providers/manager/provider-stats.store";
import type { ProviderStatusLabel } from "@/features/lead-intelligence/providers/manager/types";
import {
  getManagedProvider,
  MANAGED_PROVIDERS,
  type ManagedProviderId,
} from "@/features/provider-vault/shared/domain/provider-definitions";
import {
  getOrgProviderCredentials,
} from "@/features/provider-vault/server/credential-cache.service";
import { getActiveOrganizationId } from "@/features/provider-vault/server/org-context";

export type SearchProviderAvailability = {
  providerId: ManagedProviderId;
  name: string;
  configured: boolean;
  enabled: boolean;
  active: boolean;
  secretSource: "vault" | "env" | "none";
  healthStatus: ProviderStatusLabel;
  skipReason?: string;
};

const SEARCH_PROVIDER_RESOLVERS: Record<
  ManagedProviderId,
  () => boolean
> = {
  tavily: () => Boolean(getTavilyApiKey()),
  "brave-search": () => Boolean(getBraveSearchApiKey()),
  serpapi: () => Boolean(getSerpApiKey()),
  "google-cse": () => Boolean(getGoogleCseConfig()),
  "bing-search": () => Boolean(getBingSearchApiKey()),
  firecrawl: () => false,
  openai: () => false,
};

function hasRequiredVaultSecrets(
  providerId: ManagedProviderId,
  secrets: Record<string, string | undefined>,
): boolean {
  const definition = getManagedProvider(providerId);
  if (!definition) return false;

  return definition.secretFields
    .filter((field) => field.required)
    .every((field) => Boolean(secrets[field.key]?.trim()));
}

function resolveConfiguredFromSources(providerId: ManagedProviderId): {
  configured: boolean;
  secretSource: SearchProviderAvailability["secretSource"];
} {
  const orgId = getActiveOrganizationId();
  const vaultEntry = orgId ? getOrgProviderCredentials(orgId, providerId) : null;
  const vaultConfigured = vaultEntry ? hasRequiredVaultSecrets(providerId, vaultEntry.secrets) : false;

  if (vaultConfigured) {
    return { configured: true, secretSource: "vault" };
  }

  if (SEARCH_PROVIDER_RESOLVERS[providerId]?.()) {
    return { configured: true, secretSource: "env" };
  }

  return { configured: false, secretSource: "none" };
}

export function resolveSearchProviderAvailability(
  providerId: ManagedProviderId,
): SearchProviderAvailability {
  const definition = getManagedProvider(providerId);
  const orgId = getActiveOrganizationId();
  const vaultEntry = orgId ? getOrgProviderCredentials(orgId, providerId) : null;
  const { configured, secretSource } = resolveConfiguredFromSources(providerId);
  const enabled = vaultEntry?.enabled ?? true;
  const runtime = getProviderRuntimeStats(providerId, configured && enabled);

  let skipReason: string | undefined;
  if (!configured) {
    skipReason = `${definition?.name ?? providerId}: geen API key (vault of env)`;
  } else if (!enabled) {
    skipReason = `${definition?.name ?? providerId}: uitgeschakeld voor organisatie`;
  } else if (runtime.status === "unhealthy") {
    skipReason = `${definition?.name ?? providerId}: unhealthy (${runtime.lastError ?? "recente fouten"})`;
  }

  const active = configured && enabled && runtime.status !== "unhealthy";

  return {
    providerId,
    name: definition?.name ?? providerId,
    configured,
    enabled,
    active,
    secretSource,
    healthStatus: runtime.status,
    skipReason,
  };
}

export function getSearchProviderAvailability(logContext?: string): SearchProviderAvailability[] {
  const searchProviderIds = MANAGED_PROVIDERS.filter((provider) => provider.category === "search").map(
    (provider) => provider.id,
  );

  const availability = searchProviderIds.map((providerId) => resolveSearchProviderAvailability(providerId));
  const activeProviders = availability.filter((entry) => entry.active);

  pipelineDebug("search.providers.availability", {
    context: logContext ?? "getSearchProviderAvailability",
    organizationId: getActiveOrganizationId() ?? null,
    totalSearchProviders: availability.length,
    activeSearchProviders: activeProviders.length,
    providers: availability.map((entry) => ({
      id: entry.providerId,
      configured: entry.configured,
      enabled: entry.enabled,
      active: entry.active,
      secretSource: entry.secretSource,
      healthStatus: entry.healthStatus,
      skipReason: entry.skipReason ?? null,
    })),
  });

  console.info("[SearchProviders]", {
    context: logContext ?? "getSearchProviderAvailability",
    organizationId: getActiveOrganizationId() ?? null,
    searchProviderCount: activeProviders.length,
    providers: availability,
  });

  return availability;
}

export function getActiveSearchProviders(logContext?: string): SearchProviderAvailability[] {
  return getSearchProviderAvailability(logContext).filter((entry) => entry.active);
}

export function hasActiveSearchProviders(logContext?: string): boolean {
  return getActiveSearchProviders(logContext).length > 0;
}
