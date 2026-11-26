import type { DiscoverySearchProviderId } from "@/features/company-finder/discovery/discovery-provider-failover.types";

type QuotaState = {
  exhaustedAt: string;
  reason: string;
  httpStatus: number | null;
};

const exhaustedProviders = new Map<DiscoverySearchProviderId, QuotaState>();

/** Process-local quota latch (e.g. Tavily HTTP 432). Cleared on process restart or tests. */
export function markProviderQuotaExhausted(
  providerId: DiscoverySearchProviderId,
  reason: string,
  httpStatus: number | null = null,
): void {
  exhaustedProviders.set(providerId, {
    exhaustedAt: new Date().toISOString(),
    reason: reason.slice(0, 280),
    httpStatus,
  });
}

export function isProviderQuotaExhausted(providerId: DiscoverySearchProviderId): boolean {
  return exhaustedProviders.has(providerId);
}

export function getProviderQuotaState(
  providerId: DiscoverySearchProviderId,
): QuotaState | null {
  return exhaustedProviders.get(providerId) ?? null;
}

export function clearProviderQuotaRegistryForTests(): void {
  exhaustedProviders.clear();
}

export function listQuotaExhaustedProviders(): DiscoverySearchProviderId[] {
  return [...exhaustedProviders.keys()];
}