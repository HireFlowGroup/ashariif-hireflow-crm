import { describe, expect, it } from "vitest";

import { resolveProviderSnapshotStatus } from "@/features/provider-vault/server/provider-vault.service";
import type { ProviderRuntimeStats } from "@/features/lead-intelligence/providers/manager/types";

function runtime(overrides: Partial<ProviderRuntimeStats> = {}): ProviderRuntimeStats {
  return {
    id: "serpapi",
    requestsToday: 0,
    successCount: 0,
    failureCount: 0,
    successRate: 100,
    retryCount: 0,
    cacheHits: 0,
    cacheHitRate: 0,
    avgResponseMs: 0,
    lastResponseMs: null,
    lastError: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    healthScore: 100,
    status: "healthy",
    quotaRemaining: null,
    maxRetries: 1,
    cacheEnabled: true,
    ...overrides,
  };
}

describe("resolveProviderSnapshotStatus", () => {
  it("prefers healthy runtime status over stale persisted unhealthy after successful test", () => {
    const status = resolveProviderSnapshotStatus({
      configured: true,
      enabled: true,
      runtime: runtime({
        requestsToday: 1,
        successCount: 1,
        status: "healthy",
        healthScore: 100,
        lastSuccessAt: new Date().toISOString(),
      }),
      persistedStatus: "unhealthy",
    });

    expect(status).toBe("healthy");
  });

  it("uses persisted status when runtime has no activity yet (cold start)", () => {
    const status = resolveProviderSnapshotStatus({
      configured: true,
      enabled: true,
      runtime: runtime({ status: "healthy", healthScore: 100 }),
      persistedStatus: "degraded",
    });

    expect(status).toBe("degraded");
  });

  it("returns disabled when provider not configured", () => {
    expect(
      resolveProviderSnapshotStatus({
        configured: false,
        enabled: true,
        runtime: runtime(),
        persistedStatus: "healthy",
      }),
    ).toBe("disabled");
  });
});