import type { DiscoveryProviderDebugEntry } from "@/features/company-finder/discovery/discovery-provider-failover.types";
import {
  getProviderQuotaState,
  isProviderQuotaExhausted,
  listQuotaExhaustedProviders,
} from "@/features/company-finder/discovery/provider-quota-registry.service";
import type { DiscoveryApiBudgetSnapshot } from "@/features/company-finder/discovery/discovery-run-api-budget.service";

export type ProviderDegradedModeReport = {
  degraded: boolean;
  primaryProvider: string | null;
  activeFallbackProviders: string[];
  quotaExhaustedProviders: string[];
  messages: string[];
  budget: DiscoveryApiBudgetSnapshot | null;
};

export function buildProviderDegradedModeReport(input: {
  providerRuns: DiscoveryProviderDebugEntry[];
  successfulProviderIds: string[];
  budget: DiscoveryApiBudgetSnapshot | null;
}): ProviderDegradedModeReport {
  const quotaExhausted = listQuotaExhaustedProviders();
  const messages: string[] = [];

  for (const providerId of quotaExhausted) {
    const state = getProviderQuotaState(providerId);
    if (state) {
      messages.push(`${providerId}: quota_exhausted (${state.reason})`);
    }
  }

  const tavilyExhausted = isProviderQuotaExhausted("tavily");
  const serpSucceeded = input.successfulProviderIds.includes("serpapi");
  const degraded = tavilyExhausted || (quotaExhausted.length > 0 && input.successfulProviderIds.length > 0);

  if (tavilyExhausted && serpSucceeded) {
    messages.push("Discovery in degraded mode: Tavily uitgeschakeld, SerpAPI fallback actief.");
  }

  if (input.budget && input.budget.budgetBlocked > 0) {
    messages.push(`HTTP-budget blokkeerde ${input.budget.budgetBlocked} provider-poging(en).`);
  }

  return {
    degraded,
    primaryProvider: tavilyExhausted && serpSucceeded ? "serpapi" : input.successfulProviderIds[0] ?? null,
    activeFallbackProviders: input.successfulProviderIds,
    quotaExhaustedProviders: quotaExhausted,
    messages,
    budget: input.budget,
  };
}