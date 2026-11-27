import { describe, expect, it, vi, beforeEach } from "vitest";

import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import { executeQualityAwareDiscoveryQuery } from "@/features/company-finder/discovery/discovery-provider-runner.service";
import { clearProviderQuotaRegistryForTests } from "@/features/company-finder/discovery/provider-quota-registry.service";

function makeEnriched(overrides: Partial<EnrichedDiscoveryResult> = {}): EnrichedDiscoveryResult {
  return {
    title: "Recruiter",
    url: "https://example.nl/vacatures/recruiter",
    description: null,
    query: "test",
    resultType: "individual_vacancy",
    classificationConfidence: 0.9,
    classificationReason: "test",
    extractedCompanyName: "Example BV",
    extractedEmployer: "Example BV",
    officialDomain: "example.nl",
    domainConfidence: 0.9,
    domainSource: "url",
    vacancyTitle: "Recruiter",
    vacancyUrl: "https://example.nl/vacatures/recruiter",
    vacancySource: "tavily",
    excludedCompetitor: false,
    accepted: true,
    rejectionReason: null,
    ...overrides,
  };
}

const executeWithResilience = vi.fn();
vi.mock("@/features/lead-intelligence/providers/manager/provider-executor", () => ({
  executeWithResilience: (...args: unknown[]) => executeWithResilience(...args),
}));

const getSearchExecutor = vi.fn();
vi.mock("@/features/lead-intelligence/providers/manager/search-providers", () => ({
  getSearchExecutor: (...args: unknown[]) => getSearchExecutor(...args),
}));

vi.mock("@/features/lead-intelligence/providers/manager", () => ({
  getProviderManager: vi.fn(),
}));

vi.mock("@/features/lead-intelligence/providers/manager/provider-env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/lead-intelligence/providers/manager/provider-env")>();
  return {
    ...actual,
    getTavilyApiKey: vi.fn(() => "tavily-test"),
    getSerpApiKey: vi.fn(),
    getBraveSearchApiKey: vi.fn(() => null),
    getGoogleCseConfig: vi.fn(() => null),
    getBingSearchApiKey: vi.fn(() => null),
  };
});

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

describe("discovery provider fallback diagnostics", () => {
  beforeEach(() => {
    clearProviderQuotaRegistryForTests();
    vi.clearAllMocks();
  });

  it("marks SerpAPI fallback required but skipped when Tavily fails and SerpAPI is not configured", async () => {
    const { getSerpApiKey } = await import("@/features/lead-intelligence/providers/manager/provider-env");

    vi.mocked(getSerpApiKey).mockReturnValue(null);
    executeWithResilience.mockImplementation(async (_cfg, fn) => fn());
    getSearchExecutor.mockImplementation((id: string) => async () => {
      if (id === "tavily") {
        throw new Error(
          'Tavily HTTP 432: {"detail":{"error":"This request exceeds your plan\'s set usage limit."}}',
        );
      }
      throw new Error(`${id} unavailable`);
    });

    const result = await executeQualityAwareDiscoveryQuery({
      query: "recruiter vacature Rotterdam software",
      intent: "role_specific",
      maxResults: 5,
      timeoutMs: 5000,
      desiredRoles: ["recruiters"],
      processHits: (hits) =>
        hits.map((hit) =>
          makeEnriched({
            title: hit.title,
            url: hit.url,
            description: hit.description ?? null,
            query: "recruiter vacature Rotterdam software",
          }),
        ),
    });

    expect(result.tavilyFailed).toBe(true);
    expect(result.tavilyFailureCode).toBe("provider_quota_exhausted");
    expect(result.serpApiFallbackRequired).toBe(true);
    expect(result.serpApiFallbackSkipped).toBe(true);
    expect(result.serpApiFallbackAttempted).toBe(false);
    expect(result.serpApiFallbackTriggered).toBe(true);
    expect(result.serpApiFallbackError).toContain("SERPAPI_API_KEY");
    expect(result.tavilyErrorSanitized).toContain("HTTP 432");
    expect(result.tavilyErrorSanitized?.length).toBeLessThanOrEqual(280);
  });

  it("attempts SerpAPI when Tavily fails with quota error and SerpAPI is configured", async () => {
    const { getSerpApiKey } = await import("@/features/lead-intelligence/providers/manager/provider-env");
    const { getProviderManager } = await import("@/features/lead-intelligence/providers/manager");

    vi.mocked(getSerpApiKey).mockReturnValue("serp-test-key");
    executeWithResilience.mockImplementation(async (_cfg, fn) => fn());
    getSearchExecutor.mockImplementation((id: string) => async () => {
      if (id === "tavily") {
        throw new Error("Tavily HTTP 432: usage limit exceeded");
      }
      if (id === "serpapi") {
        return {
          data: [
            {
              title: "Recruiter vacature",
              url: "https://acme.nl/vacatures/recruiter",
              description: "Wij zoeken een recruiter",
            },
          ],
          responseSize: 50,
        };
      }
      return { data: [], responseSize: 0 };
    });

    vi.mocked(getProviderManager).mockReturnValue({
      executeSingleProviderSearch: vi.fn(),
    } as never);

    const result = await executeQualityAwareDiscoveryQuery({
      query: "recruiter vacature Rotterdam software",
      intent: "role_specific",
      maxResults: 5,
      timeoutMs: 5000,
      desiredRoles: ["recruiters"],
      processHits: (hits, providerId) =>
        hits.map((hit) =>
          makeEnriched({
            title: hit.title,
            url: hit.url,
            description: hit.description ?? null,
            query: "recruiter vacature Rotterdam software",
            vacancyTitle: hit.title.includes("Recruiter") ? "Recruiter" : null,
            vacancyUrl: hit.url,
            officialDomain: hit.url.includes("acme.nl") ? "acme.nl" : null,
            accepted: hit.url.includes("acme.nl"),
            sourceProvider: providerId,
          }),
        ),
    });

    expect(getSearchExecutor).toHaveBeenCalledWith("tavily");
    expect(getSearchExecutor).toHaveBeenCalledWith("serpapi");
    expect(result.tavilyFailureCode).toBe("provider_quota_exhausted");
    expect(result.tavilyFailed).toBe(true);
    expect(result.providersUsed).toContain("serpapi");
    expect(result.combinedMetrics.desiredRoleVacancyMatches).toBeGreaterThan(0);
    expect(result.serpApiFallbackAttempted).toBe(false);
  });
});