import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveDiscoveryMaxProviderAttempts,
} from "@/features/company-finder/discovery/discovery-provider-resilience.service";
import {
  classifyProviderError,
  formatDiscoveryProviderFailureMessage,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";

describe("resolveDiscoveryMaxProviderAttempts", () => {
  const prevMax = process.env.AI_RECRUITER_DISCOVERY_MAX_PROVIDER_ATTEMPTS;
  const prevTavily = process.env.TAVILY_API_KEY;
  const prevSerp = process.env.SERPAPI_API_KEY;

  beforeEach(() => {
    process.env.AI_RECRUITER_DISCOVERY_MAX_PROVIDER_ATTEMPTS = "1";
    process.env.TAVILY_API_KEY = "tavily-test";
    process.env.SERPAPI_API_KEY = "serp-test";
  });

  afterEach(() => {
    process.env.AI_RECRUITER_DISCOVERY_MAX_PROVIDER_ATTEMPTS = prevMax;
    process.env.TAVILY_API_KEY = prevTavily;
    process.env.SERPAPI_API_KEY = prevSerp;
  });

  it("ensures minimum 2 provider attempts when Tavily and SerpAPI are both configured", () => {
    expect(resolveDiscoveryMaxProviderAttempts()).toBe(2);
  });

  it("respects cap at configured provider count", () => {
    delete process.env.SERPAPI_API_KEY;
    expect(resolveDiscoveryMaxProviderAttempts()).toBe(1);
  });
});

describe("classifyProviderError quota vs rate", () => {
  it("maps Tavily HTTP 432 plan limit to provider_quota_exhausted", () => {
    const message =
      'Tavily HTTP 432: {"detail":{"error":"This request exceeds your plan\'s set usage limit."}}';
    expect(classifyProviderError(message, 432)).toBe("provider_quota_exhausted");
  });

  it("maps HTTP 429 to provider_rate_limited", () => {
    expect(classifyProviderError("Rate limit exceeded", 429)).toBe("provider_rate_limited");
  });
});

describe("formatDiscoveryProviderFailureMessage", () => {
  it("describes SerpAPI missing when Tavily 432", () => {
    const result = formatDiscoveryProviderFailureMessage([
      {
        tavilyFailureCode: "provider_quota_exhausted",
        error: "Tavily HTTP 432: usage limit",
        serpApiFallbackSkipped: true,
        serpApiFallbackError: "SerpAPI niet geconfigureerd",
      },
    ]);

    expect(result?.code).toBe("provider_quota_exhausted");
    expect(result?.message).toMatch(/SerpAPI-fallback niet mogelijk|Configureer SerpAPI/i);
  });
});