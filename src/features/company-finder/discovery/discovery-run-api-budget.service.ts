import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import type { DiscoverySearchProviderId } from "@/features/company-finder/discovery/discovery-provider-failover.types";

export type DiscoveryApiBudgetSnapshot = {
  runId: string | null;
  totalHttpAttempts: number;
  limits: {
    perRun: number;
    perProvider: Record<string, number>;
  };
  byProvider: Record<string, number>;
  cacheHits: number;
  budgetBlocked: number;
};

export type DiscoveryRunApiBudget = {
  runId: string | null;
  tryConsumeHttpAttempt: (providerId: DiscoverySearchProviderId) => { allowed: boolean; reason?: string };
  recordCacheHit: (providerId: DiscoverySearchProviderId) => void;
  snapshot: () => DiscoveryApiBudgetSnapshot;
};

function providerHttpLimit(providerId: string, config: ReturnType<typeof getAiRecruiterConfig>): number {
  if (providerId === "tavily") return config.discoveryMaxHttpAttemptsTavily;
  if (providerId === "serpapi") return config.discoveryMaxHttpAttemptsSerpapi;
  return config.discoveryMaxHttpAttemptsOtherProviders;
}

export function createDiscoveryRunApiBudget(runId?: string | null): DiscoveryRunApiBudget {
  const config = getAiRecruiterConfig();
  const byProvider: Record<string, number> = {};
  let totalHttpAttempts = 0;
  let cacheHits = 0;
  let budgetBlocked = 0;

  return {
    runId: runId ?? null,
    tryConsumeHttpAttempt(providerId) {
      if (totalHttpAttempts >= config.discoveryMaxHttpAttemptsPerRun) {
        budgetBlocked += 1;
        return {
          allowed: false,
          reason: `Run HTTP-budget bereikt (${config.discoveryMaxHttpAttemptsPerRun})`,
        };
      }
      const perProvider = byProvider[providerId] ?? 0;
      const limit = providerHttpLimit(providerId, config);
      if (perProvider >= limit) {
        budgetBlocked += 1;
        return {
          allowed: false,
          reason: `Provider HTTP-budget bereikt voor ${providerId} (${limit})`,
        };
      }
      byProvider[providerId] = perProvider + 1;
      totalHttpAttempts += 1;
      return { allowed: true };
    },
    recordCacheHit() {
      cacheHits += 1;
    },
    snapshot() {
      return {
        runId: runId ?? null,
        totalHttpAttempts,
        limits: {
          perRun: config.discoveryMaxHttpAttemptsPerRun,
          perProvider: {
            tavily: config.discoveryMaxHttpAttemptsTavily,
            serpapi: config.discoveryMaxHttpAttemptsSerpapi,
            other: config.discoveryMaxHttpAttemptsOtherProviders,
          },
        },
        byProvider: { ...byProvider },
        cacheHits,
        budgetBlocked,
      };
    },
  };
}