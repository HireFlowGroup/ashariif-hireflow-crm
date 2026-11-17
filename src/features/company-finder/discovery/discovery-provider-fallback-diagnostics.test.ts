import { describe, expect, it, vi, beforeEach } from "vitest";

import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import { executeQualityAwareDiscoveryQuery } from "@/features/company-finder/discovery/discovery-provider-runner.service";

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

vi.mock("@/features/lead-intelligence/providers/manager", () => ({
  getProviderManager: vi.fn(),
}));

vi.mock("@/features/lead-intelligence/providers/manager/provider-env", () => ({
  getSerpApiKey: vi.fn(),
}));

describe("discovery provider fallback diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks SerpAPI fallback required but skipped when Tavily fails and SerpAPI is not configured", async () => {
    const { getProviderManager } = await import("@/features/lead-intelligence/providers/manager");
    const { getSerpApiKey } = await import("@/features/lead-intelligence/providers/manager/provider-env");

    vi.mocked(getSerpApiKey).mockReturnValue(null);
    vi.mocked(getProviderManager).mockReturnValue({
      executeSingleProviderSearch: vi.fn().mockRejectedValue(
        new Error(
          'Tavily HTTP 432: {"detail":{"error":"This request exceeds your plan\'s set usage limit."}}',
        ),
      ),
    } as never);

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
    expect(result.tavilyFailureCode).toBe("provider_rate_limited");
    expect(result.serpApiFallbackRequired).toBe(true);
    expect(result.serpApiFallbackSkipped).toBe(true);
    expect(result.serpApiFallbackAttempted).toBe(false);
    expect(result.serpApiFallbackTriggered).toBe(true);
    expect(result.serpApiFallbackError).toContain("SERPAPI_API_KEY");
    expect(result.tavilyErrorSanitized).toContain("HTTP 432");
    expect(result.tavilyErrorSanitized?.length).toBeLessThanOrEqual(280);
  });

  it("attempts SerpAPI when Tavily fails with quota error and SerpAPI is configured", async () => {
    const { getProviderManager } = await import("@/features/lead-intelligence/providers/manager");
    const { getSerpApiKey } = await import("@/features/lead-intelligence/providers/manager/provider-env");

    vi.mocked(getSerpApiKey).mockReturnValue("serp-test-key");
    const executeSingleProviderSearch = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Tavily HTTP 432: usage limit exceeded"),
      )
      .mockResolvedValueOnce({
        results: [
          {
            title: "Recruiter vacature",
            url: "https://acme.nl/vacatures/recruiter",
            description: "Wij zoeken een recruiter",
          },
        ],
        durationMs: 10,
        fromCache: false,
        attempt: 1,
      });

    vi.mocked(getProviderManager).mockReturnValue({
      executeSingleProviderSearch,
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

    expect(executeSingleProviderSearch).toHaveBeenCalledTimes(2);
    expect(result.tavilyFailureCode).toBe("provider_rate_limited");
    expect(result.serpApiFallbackAttempted).toBe(true);
    expect(result.serpApiFallbackSkipped).toBe(false);
    expect(result.serpApiFallbackSucceeded).toBe(true);
    expect(result.providersUsed).toContain("serpapi");
  });
});