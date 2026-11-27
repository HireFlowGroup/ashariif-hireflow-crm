import { describe, expect, it } from "vitest";

import {
  buildSerpApiBroadDiscoveryQuery,
  prepareSerpApiDiscoveryQuery,
  shouldNormalizeSerpDiscoveryQuery,
} from "@/features/company-finder/discovery/discovery-serpapi-query.service";

describe("discovery SerpAPI query normalization", () => {
  const tavilyStyleQuery =
    'recruiter vacature Rotterdam software inurl:vacatures OR inurl:careers -indeed -linkedin -glassdoor -monster -stepstone';

  it("detects Tavily-oriented discovery syntax", () => {
    expect(shouldNormalizeSerpDiscoveryQuery(tavilyStyleQuery)).toBe(true);
    expect(shouldNormalizeSerpDiscoveryQuery("recruiter vacature Rotterdam")).toBe(false);
  });

  it("strips inurl/or tokens for SerpAPI", () => {
    const normalized = prepareSerpApiDiscoveryQuery(tavilyStyleQuery);
    expect(normalized.toLowerCase()).not.toMatch(/inurl:/);
    expect(normalized).toContain("recruiter");
    expect(normalized).toContain("Rotterdam");
    expect(normalized).toMatch(/-indeed/);
    expect(normalized.length).toBeLessThanOrEqual(256);
  });

  it("skips normalization for LinkedIn x-ray queries", () => {
    const xray = 'site:linkedin.com/in "Corporate Recruiter" Rotterdam';
    expect(shouldNormalizeSerpDiscoveryQuery(xray)).toBe(false);
    expect(prepareSerpApiDiscoveryQuery(xray)).toBe(xray);
  });

  it("builds compact broadening query from role and location", () => {
    const broad = buildSerpApiBroadDiscoveryQuery({
      role: "Corporate Recruiter",
      location: "Den Haag",
      sector: "software",
    });
    expect(broad).toMatch(/vacature/i);
    expect(broad).toMatch(/Corporate Recruiter|Recruiter/);
    expect(broad).toMatch(/Den Haag/);
    expect(shouldNormalizeSerpDiscoveryQuery(broad)).toBe(false);
  });
});