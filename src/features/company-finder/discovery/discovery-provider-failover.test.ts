import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyDiscoveryProviderError,
  executeDiscoverySearchWithFailover,
  mergeDiscoveryProviderRuns,
} from "@/features/company-finder/discovery/discovery-provider-failover.service";
import { DISCOVERY_ALL_PROVIDERS_FAILED_MESSAGE } from "@/features/company-finder/discovery/discovery-provider-failover.types";

vi.mock("@/features/lead-intelligence/providers/manager/provider-env", () => ({
  getTavilyApiKey: () => "tvly-test",
  getBraveSearchApiKey: () => "brave-test",
  getGoogleCseConfig: () => null,
  getBingSearchApiKey: () => null,
  getSerpApiKey: () => "serp-test",
  getOpenAiApiKey: () => null,
}));

const executeWithResilience = vi.fn();
vi.mock("@/features/lead-intelligence/providers/manager/provider-executor", () => ({
  executeWithResilience: (...args: unknown[]) => executeWithResilience(...args),
}));

const getSearchExecutor = vi.fn();
vi.mock("@/features/lead-intelligence/providers/manager/search-providers", () => ({
  getSearchExecutor: (...args: unknown[]) => getSearchExecutor(...args),
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
        cacheEnabled: false,
        cacheTtlMs: 0,
      },
    }),
  }),
}));

beforeEach(() => {
  executeWithResilience.mockReset();
  getSearchExecutor.mockReset();
});

describe("classifyDiscoveryProviderError", () => {
  it("skips providers listed in skipProviderIds without API call", async () => {
    const executor = vi.fn();
    vi.mocked(getSearchExecutor).mockReturnValue(executor);

    const result = await executeDiscoverySearchWithFailover("software rotterdam", 5, {
      maxProviderAttempts: 3,
      skipProviderIds: new Set(["tavily"]),
    });

    const tavilyRun = result.providerRuns.find((run) => run.providerId === "tavily");
    expect(tavilyRun?.skipped).toBe(true);
    expect(tavilyRun?.skipReason).toBe("quota_exceeded");
    expect(executor).not.toHaveBeenCalled();
  });

  it("classifies Tavily HTTP 432 as quota_exceeded", () => {
    expect(
      classifyDiscoveryProviderError(
        new Error(
          'Tavily HTTP 432: {"detail":{"error":"This request exceeds your plan\'s set usage limit."}}',
        ),
      ),
    ).toBe("quota_exceeded");
  });
});

describe("executeDiscoverySearchWithFailover", () => {
  it("falls through Tavily quota to the next provider and stops on first success", async () => {
    executeWithResilience.mockImplementation(async (_cfg, fn) => {
      const id = _cfg.providerId as string;
      if (id === "tavily") {
        throw new Error("Tavily HTTP 432: usage limit");
      }
      return fn();
    });

    getSearchExecutor.mockImplementation((id: string) => {
      if (id === "tavily") {
        return async () => {
          throw new Error("Tavily HTTP 432: usage limit");
        };
      }
      if (id === "brave-search") {
        return async () => ({
          data: [{ title: "Acme BV", url: "https://acme.nl/vacatures", description: "vacature" }],
          responseSize: 100,
        });
      }
      return null;
    });

    const result = await executeDiscoverySearchWithFailover("software vacature Rotterdam", 5, {
      stopOnFirstSuccess: true,
      maxProviderAttempts: 3,
    });

    expect(result.successfulProviderIds).toEqual(["brave-search"]);
    expect(result.results).toHaveLength(1);
    expect(result.allProvidersSkipped).toBe(false);
    expect(executeWithResilience.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("selects SerpAPI when Tavily quota fails and earlier providers are unconfigured", async () => {
    executeWithResilience.mockImplementation(async (_cfg, fn) => fn());

    getSearchExecutor.mockImplementation((id: string) => {
      if (id === "tavily") {
        return async () => {
          throw new Error("Tavily HTTP 432: usage limit");
        };
      }
      if (id === "serpapi") {
        return async () => ({
          data: [{ title: "Beta BV", url: "https://beta.nl/werken-bij", description: "werken bij" }],
          responseSize: 120,
        });
      }
      return async () => ({ data: [], responseSize: 0 });
    });

    const result = await executeDiscoverySearchWithFailover("software Rotterdam recruiter", 5, {
      stopOnFirstSuccess: true,
      maxProviderAttempts: 5,
    });

    expect(result.successfulProviderIds).toContain("serpapi");
    expect(result.results.length).toBeGreaterThan(0);
    const tavilyRun = result.providerRuns.find((entry) => entry.providerId === "tavily");
    expect(tavilyRun?.skipReason).toBe("quota_exceeded");
  });
});

describe("mergeDiscoveryProviderRuns", () => {
  it("lists all providers with configured state and merges successes", () => {
    const merged = mergeDiscoveryProviderRuns([
      {
        providerId: "brave-search",
        name: "Brave",
        configured: true,
        started: true,
        success: true,
        skipped: false,
        skipReason: null,
        resultCount: 2,
        durationMs: 50,
      },
    ]);

    expect(merged).toHaveLength(7);
    expect(merged.find((entry) => entry.providerId === "brave-search")?.resultCount).toBe(2);
  });
});

describe("DISCOVERY_ALL_PROVIDERS_FAILED_MESSAGE", () => {
  it("uses the expected Dutch failure message", () => {
    expect(DISCOVERY_ALL_PROVIDERS_FAILED_MESSAGE).toBe("Geen werkende searchprovider beschikbaar.");
  });
});