import {
  braveGoogleMapsProvider,
  braveIndeedProvider,
  braveNationaleVacaturebankProvider,
  braveWebSearchProvider,
  braveWerkenBijProvider,
} from "@/features/lead-intelligence/providers/discovery/brave-discovery.providers";
import type { RecruitmentDiscoveryProvider } from "@/features/lead-intelligence/providers/pipeline/types";
import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";

const discoveryProviders: RecruitmentDiscoveryProvider[] = [
  braveWebSearchProvider,
  braveGoogleMapsProvider,
  braveIndeedProvider,
  braveNationaleVacaturebankProvider,
  braveWerkenBijProvider,
];

export function getDiscoveryProviders(): RecruitmentDiscoveryProvider[] {
  return [...discoveryProviders]
    .filter((provider) => provider.enabled)
    .sort((a, b) => a.order - b.order);
}

export function getAllDiscoveryProviders(): RecruitmentDiscoveryProvider[] {
  return [...discoveryProviders].sort((a, b) => a.order - b.order);
}

export function getSkippedDiscoveryProviders(): Array<{ name: string; reason: string }> {
  return discoveryProviders
    .filter((provider) => !provider.enabled)
    .map((provider) => ({
      name: provider.displayName,
      reason: provider.skipReason ?? "Uitgeschakeld",
    }));
}

export function registerDiscoveryProvider(provider: RecruitmentDiscoveryProvider): void {
  const index = discoveryProviders.findIndex((existing) => existing.id === provider.id);

  if (index >= 0) {
    discoveryProviders[index] = provider;
    return;
  }

  discoveryProviders.push(provider);
}

export function logDiscoveryRegistryState(): void {
  pipelineDebug("discovery.registry", {
    registered: getAllDiscoveryProviders().map((provider) => ({
      id: provider.id,
      order: provider.order,
      enabled: provider.enabled,
      skipReason: provider.skipReason ?? null,
    })),
    active: getDiscoveryProviders().map((provider) => provider.id),
    skipped: getSkippedDiscoveryProviders(),
  });
}

/** @deprecated Use getDiscoveryProviders */
export function getSearchProviders() {
  return getDiscoveryProviders();
}

/** @deprecated Use getSkippedDiscoveryProviders */
export function getSkippedProviders() {
  return getSkippedDiscoveryProviders();
}

export function logProviderRegistryState() {
  logDiscoveryRegistryState();
}
