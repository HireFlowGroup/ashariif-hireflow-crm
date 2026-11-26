import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dedupeDiscoveryQueryVariants } from "@/features/company-finder/discovery/discovery-query-dedupe.service";
import { createDiscoveryRunApiBudget } from "@/features/company-finder/discovery/discovery-run-api-budget.service";
import { executeDiscoverySearchWithFailover } from "@/features/company-finder/discovery/discovery-provider-failover.service";
import {
  clearProviderQuotaRegistryForTests,
  isProviderQuotaExhausted,
  markProviderQuotaExhausted,
} from "@/features/company-finder/discovery/provider-quota-registry.service";
import { buildProviderDegradedModeReport } from "@/features/company-finder/discovery/provider-degraded-mode.service";
import {
  createEmptyProviderRequestTelemetry,
  recordDiscoveryQueryTelemetry,
} from "@/features/ai-recruiter/services/provider-request-telemetry.service";
import { validateSlotSaveConsistency } from "@/features/ai-recruiter/services/run-slot-observability.service";
import {
  buildCacheKey,
  setCached,
  clearProviderCache,
} from "@/features/lead-intelligence/providers/manager/provider-cache";
import { buildPipelineFunnelDiagnostics } from "@/features/ai-recruiter/services/pipeline-funnel-diagnostics.service";
import { emptyDiscoverySummary } from "@/features/ai-recruiter/services/discovery-run-diagnostics.service";
import { resolveDiscoverySearchReadiness } from "@/features/ai-recruiter/services/discovery-search-readiness.service";

const executeWithResilienceMock = vi.fn();
vi.mock("@/features/lead-intelligence/providers/manager/provider-executor", () => ({
  executeWithResilience: (...args: unknown[]) => executeWithResilienceMock(...args),
}));

const getSearchExecutorMock = vi.fn();
vi.mock("@/features/lead-intelligence/providers/manager/search-providers", () => ({
  getSearchExecutor: (...args: unknown[]) => getSearchExecutorMock(...args),
}));

vi.mock("@/features/lead-intelligence/providers/manager/provider-registry", () => ({
  ensureProviderRegistryBootstrapped: vi.fn(),
  getProviderRegistry: () => ({
    get: (id: string) => ({
      definition: {
        id,
        name: id,
        timeoutMs: 5_000,
        maxRetries: 0,
        rateLimitPerMinute: 60,
        cacheEnabled: true,
        cacheTtlMs: 300_000,
      },
    }),
  }),
}));

vi.mock("@/features/lead-intelligence/providers/manager/provider-env", () => ({
  getTavilyApiKey: vi.fn(() => "tavily-test"),
  getSerpApiKey: vi.fn(() => "serp-test"),
  getBraveSearchApiKey: vi.fn(() => null),
  getGoogleCseConfig: vi.fn(() => null),
  getBingSearchApiKey: vi.fn(() => null),
  getOpenAiApiKey: vi.fn(() => null),
}));

describe("P0-R3.2.2 offline provider reliability", () => {
  beforeEach(() => {
    clearProviderQuotaRegistryForTests();
    clearProviderCache();
    executeWithResilienceMock.mockReset();
    getSearchExecutorMock.mockReset();
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN = "5";
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_TAVILY = "2";
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI = "3";
  });

  afterEach(() => {
    delete process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN;
    delete process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_TAVILY;
    delete process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI;
  });

  it("dedupes identical discovery queries", () => {
    const { unique, duplicatesRemoved } = dedupeDiscoveryQueryVariants([
      { query: "software Rotterdam", intent: "company" as const, label: "a", location: "Rotterdam", role: "" },
      { query: "  software   rotterdam ", intent: "company" as const, label: "b", location: "Rotterdam", role: "" },
    ]);
    expect(unique).toHaveLength(1);
    expect(duplicatesRemoved).toBe(1);
  });

  it("successful Tavily response (synthetic)", async () => {
    const executor = vi.fn();
    getSearchExecutorMock.mockReturnValue(executor);
    executeWithResilienceMock.mockImplementation(async (_cfg, fn) => {
      const result = await fn(10_000);
      return { data: result.data, durationMs: 10, responseSize: 1, fromCache: false, attempt: 0 };
    });
    executor.mockResolvedValue({
      data: [{ title: "Acme", url: "https://acme.nl/jobs", description: "vacature" }],
      responseSize: 1,
    });

    const result = await executeDiscoverySearchWithFailover("software Rotterdam", 5, {
      stopOnFirstSuccess: true,
      maxProviderAttempts: 3,
    });

    expect(result.successfulProviderIds).toContain("tavily");
    expect(result.allProvidersSkipped).toBe(false);
  });

  it("Tavily 432 triggers quota latch and SerpAPI fallback", async () => {
    getSearchExecutorMock.mockImplementation((id: string) => async () => ({
      data: id === "serpapi"
        ? [{ title: "Fallback Co", url: "https://fallback.nl", description: "x" }]
        : [],
      responseSize: 1,
    }));

    executeWithResilienceMock.mockImplementation(async (cfg, fn) => {
      if (cfg.providerId === "tavily") {
        throw new Error(
          'Tavily HTTP 432: {"detail":{"error":"usage limit"}}',
        );
      }
      const result = await fn(10_000);
      return { data: result.data, durationMs: 5, responseSize: 1, fromCache: false, attempt: 0 };
    });

    const result = await executeDiscoverySearchWithFailover("q1", 5, {
      stopOnFirstSuccess: true,
      maxProviderAttempts: 5,
    });

    expect(isProviderQuotaExhausted("tavily")).toBe(true);
    expect(result.successfulProviderIds).toContain("serpapi");
    const report = buildProviderDegradedModeReport({
      providerRuns: result.providerRuns,
      successfulProviderIds: result.successfulProviderIds,
      budget: null,
    });
    expect(report.degraded).toBe(true);
  });

  it("both Tavily and SerpAPI unavailable returns allProvidersSkipped", async () => {
    getSearchExecutorMock.mockReturnValue(executorThatThrows);
    executeWithResilienceMock.mockImplementation(async (cfg) => {
      if (cfg.providerId === "tavily") {
        throw new Error('Tavily HTTP 432: usage limit');
      }
      throw new Error("SerpAPI time-out na 10000ms");
    });

    const result = await executeDiscoverySearchWithFailover("q2", 5, {
      stopOnFirstSuccess: true,
      maxProviderAttempts: 5,
    });

    expect(result.allProvidersSkipped).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it("quota exhaustion mid-run skips further Tavily HTTP", async () => {
    markProviderQuotaExhausted("tavily", "pre-test exhausted", 432);
    const tavilyExecutor = vi.fn();
    getSearchExecutorMock.mockImplementation((id) =>
      id === "tavily" ? tavilyExecutor : async () => ({ data: [], responseSize: 0 }),
    );
    executeWithResilienceMock.mockImplementation(async (_cfg, fn) => {
      const result = await fn(10_000);
      return { data: result.data, durationMs: 1, responseSize: 0, fromCache: false, attempt: 0 };
    });

    await executeDiscoverySearchWithFailover("q3", 5, {
      skipProviderIds: new Set(["tavily"]),
      maxProviderAttempts: 2,
    });

    expect(tavilyExecutor).not.toHaveBeenCalled();
  });

  it("cache hit does not consume HTTP budget", async () => {
    const budget = createDiscoveryRunApiBudget("run-test");
    setCached(buildCacheKey("tavily", "software rotterdam:5:tavily"), [
      { title: "Cached", url: "https://cached.nl", description: "d" },
    ]);

    getSearchExecutorMock.mockReturnValue(async () => ({ data: [], responseSize: 0 }));
    executeWithResilienceMock.mockResolvedValue({
      data: [{ title: "Cached", url: "https://cached.nl", description: "d" }],
      durationMs: 0,
      responseSize: 1,
      fromCache: true,
      attempt: 0,
    });

    await executeDiscoverySearchWithFailover("software rotterdam", 5, {
      apiBudget: budget,
      maxProviderAttempts: 1,
    });

    const snap = budget.snapshot();
    expect(snap.totalHttpAttempts).toBe(0);
    expect(snap.cacheHits).toBe(1);
  });

  it("HTTP budget cannot be exceeded", () => {
    const budget = createDiscoveryRunApiBudget("run-cap");
    for (let i = 0; i < 3; i++) {
      expect(budget.tryConsumeHttpAttempt("serpapi").allowed).toBe(true);
    }
    const providerCap = budget.tryConsumeHttpAttempt("serpapi");
    expect(providerCap.allowed).toBe(false);
    expect(budget.snapshot().totalHttpAttempts).toBe(3);

    const prevRun = process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN;
    const prevSerp = process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI;
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN = "4";
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI = "10";
    const runBudget = createDiscoveryRunApiBudget("run-cap-total");
    for (let i = 0; i < 4; i++) {
      expect(runBudget.tryConsumeHttpAttempt("serpapi").allowed).toBe(true);
    }
    expect(runBudget.tryConsumeHttpAttempt("serpapi").allowed).toBe(false);
    expect(runBudget.snapshot().totalHttpAttempts).toBe(4);
    expect(runBudget.snapshot().budgetBlocked).toBe(1);
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN = prevRun;
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI = prevSerp;
  });

  it("telemetry separates HTTP attempts from estimated billable units", () => {
    const telemetry = recordDiscoveryQueryTelemetry(createEmptyProviderRequestTelemetry(), [
      {
        providerId: "tavily",
        name: "Tavily",
        configured: true,
        started: true,
        success: false,
        skipped: true,
        skipReason: "quota_exceeded",
        resultCount: 0,
        durationMs: 1,
        httpInvoked: true,
      },
      {
        providerId: "serpapi",
        name: "SerpAPI",
        configured: true,
        started: true,
        success: true,
        skipped: false,
        skipReason: null,
        resultCount: 2,
        durationMs: 2,
        httpInvoked: true,
      },
    ]);

    expect(telemetry.providerHttpAttempts).toBe(2);
    expect(telemetry.actualHttpCalls).toBe(2);
    expect(telemetry.estimatedBillableUnits).toBeGreaterThanOrEqual(telemetry.actualHttpCalls);
  });

  it("slot vs save consistency validator", () => {
    expect(validateSlotSaveConsistency({ companiesReserved: 1, companiesSaved: 1, draftsReserved: 1, draftsCreated: 1 }).ok).toBe(true);
    expect(validateSlotSaveConsistency({ companiesReserved: 0, companiesSaved: 1, draftsReserved: 0, draftsCreated: 0 }).ok).toBe(false);
  });

  it("pipeline funnel reports degraded mode + eligible prospect + concept (synthetic)", () => {
    const funnel = buildPipelineFunnelDiagnostics({
      discoverySummary: { ...emptyDiscoverySummary(), responseCount: 2, providerName: "serpapi" },
      counters: {
        found: 2,
        validated: 1,
        withVacancies: 1,
        withSignals: 0,
        contactFound: 1,
        generalMailboxFound: 0,
        blockedMissingContact: 0,
        draftsCreated: 1,
        approved: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        replies: 0,
      },
      eligibilityDecisions: [
        {
          eligible: true,
          qualificationStatus: "eligible",
          score: 66,
          threshold: 30,
          priority: "priority_b",
          acceptedRules: ["eligible_for_concept"],
          rejectedRules: [],
          reasonCode: "eligible",
          userMessage: "Prospect is eligible voor conceptgeneratie.",
        },
      ],
      enrichmentAttempts: 1,
      conceptsCreated: 1,
      providerTelemetry: recordDiscoveryQueryTelemetry(createEmptyProviderRequestTelemetry(), []),
      providerDegradedMode: {
        degraded: true,
        primaryProvider: "serpapi",
        activeFallbackProviders: ["serpapi"],
        quotaExhaustedProviders: ["tavily"],
        messages: ["Tavily quota uitgeput; fallback SerpAPI actief"],
        budget: null,
      },
    });
    expect(funnel.eligibleProspects).toBe(1);
    expect(funnel.concepts).toBe(1);
    expect(funnel.providerDegradedMode?.degraded).toBe(true);
  });

  it("discovery readiness allows SerpAPI when Tavily quota exhausted", () => {
    markProviderQuotaExhausted("tavily", "432", 432);
    const readiness = resolveDiscoverySearchReadiness();
    expect(readiness.canStart).toBe(true);
    expect(readiness.degraded).toBe(true);
    expect(readiness.primaryProvider).toBe("serpapi");
  });

  it("discovery readiness prefers SerpAPI when Tavily HTTP budget is 0", () => {
    const prev = process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_TAVILY;
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_TAVILY = "0";
    const readiness = resolveDiscoverySearchReadiness();
    expect(readiness.primaryProvider).toBe("serpapi");
    expect(readiness.degraded).toBe(true);
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_TAVILY = prev;
  });
});

async function executorThatThrows(): Promise<{ data: never[]; responseSize: number }> {
  throw new Error("unavailable");
}