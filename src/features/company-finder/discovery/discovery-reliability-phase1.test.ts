import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  buildVacancyDrivenDiscoveryQueries,
  primaryDesiredRoles,
  selectDiscoveryQueries,
} from "@/features/ai-recruiter/services/discovery-query-builder.service";
import {
  dedupeEnrichedDiscoveryResults,
  mergeEnrichedDiscoveryResults,
} from "@/features/company-finder/discovery/discovery-result-dedupe.service";
import {
  evaluateUsefulRecall,
  shouldTriggerSerpApiFallback,
} from "@/features/company-finder/discovery/discovery-useful-recall.service";
import { executeQualityAwareDiscoveryQuery } from "@/features/company-finder/discovery/discovery-provider-runner.service";
import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import { classifyDiscoveryResult } from "@/features/company-finder/discovery/result-classifier.service";
import {
  hasConcreteJobUrl,
  isCareersListingPath,
} from "@/features/ai-recruiter/services/vacancy-url.validation";

const baseCriteria = {
  city: "Rotterdam",
  sector: "software",
  locations: ["Rotterdam", "Den Haag"],
  desiredRoles: ["recruiters", "accountmanagers", "customer success managers"],
  maxResults: 25,
};

const basePlan = {
  locations: ["Rotterdam", "Den Haag"],
  sectors: ["software"],
  desired_roles: ["recruiters", "accountmanagers", "customer success managers"],
  employee_range: { min: 20, max: 200 },
  maximum_companies: 25,
};

function makeEnriched(overrides: Partial<EnrichedDiscoveryResult>): EnrichedDiscoveryResult {
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
  getSerpApiKey: vi.fn(() => "serp-key"),
}));

describe("discovery reliability phase 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers all locations and desired roles in selected queries", () => {
    const selected = selectDiscoveryQueries(
      buildVacancyDrivenDiscoveryQueries(baseCriteria, basePlan as never),
    );

    expect(selected.length).toBeGreaterThanOrEqual(12);
    expect(selected.some((q) => q.location === "Rotterdam")).toBe(true);
    expect(selected.some((q) => q.location === "Den Haag")).toBe(true);
    expect(selected.some((q) => q.role === "recruiter")).toBe(true);
    expect(selected.some((q) => q.role === "accountmanager")).toBe(true);
    expect(selected.some((q) => q.role === "customer success manager")).toBe(true);
    expect(selected.every((q) => q.intent !== "company_discovery")).toBe(true);
    expect(selected.every((q) => !q.query.includes("site:indeed.com"))).toBe(true);
    expect(selected.every((q) => q.query.includes("vacature") || q.query.includes("werken bij"))).toBe(true);
  });

  it("maps plural desired roles to canonical primary roles", () => {
    expect(primaryDesiredRoles(["recruiters", "accountmanagers", "customer success managers"])).toEqual([
      "recruiter",
      "accountmanager",
      "customer success manager",
    ]);
  });

  it("does not trigger SerpAPI when Tavily has useful employer-hosted recall", () => {
    const metrics = evaluateUsefulRecall(
      [
        makeEnriched({
          url: "https://example.nl/vacatures/recruiter",
          vacancyUrl: "https://example.nl/vacatures/recruiter",
        }),
      ],
      basePlan.desired_roles,
    );

    expect(metrics.usefulRecall).toBe(true);
    expect(
      shouldTriggerSerpApiFallback(metrics, {
        serpApiAvailable: true,
        tavilyFailed: false,
        vacancyFocusedQuery: true,
      }).trigger,
    ).toBe(false);
  });

  it("triggers SerpAPI when Tavily is technically successful but has zero useful recall", () => {
    const metrics = evaluateUsefulRecall(
      [
        makeEnriched({
          accepted: false,
          officialDomain: null,
          resultType: "vacancy_board",
          url: "https://www.indeed.com/viewjob",
        }),
      ],
      basePlan.desired_roles,
    );

    const decision = shouldTriggerSerpApiFallback(metrics, {
      serpApiAvailable: true,
      tavilyFailed: false,
      vacancyFocusedQuery: true,
    });

    expect(metrics.technicalSuccess).toBe(true);
    expect(metrics.usefulRecall).toBe(false);
    expect(decision.trigger).toBe(true);
    expect(decision.reason).toContain("concrete");
  });

  it("triggers SerpAPI when Tavily has raw hits but no desired-role vacancy matches", () => {
    const metrics = evaluateUsefulRecall(
      [
        makeEnriched({
          vacancyTitle: "Software Engineer",
          title: "Software Engineer",
          url: "https://example.nl/vacatures/software-engineer",
          vacancyUrl: "https://example.nl/vacatures/software-engineer",
        }),
        makeEnriched({
          vacancyTitle: "DevOps Engineer",
          title: "DevOps Engineer",
          url: "https://other.nl/vacatures/devops",
          vacancyUrl: "https://other.nl/vacatures/devops",
        }),
        makeEnriched({
          vacancyTitle: "Product Owner",
          title: "Product Owner",
          url: "https://third.nl/vacatures/product-owner",
          vacancyUrl: "https://third.nl/vacatures/product-owner",
        }),
      ],
      basePlan.desired_roles,
    );

    const decision = shouldTriggerSerpApiFallback(metrics, {
      serpApiAvailable: true,
      tavilyFailed: false,
      vacancyFocusedQuery: true,
    });

    expect(metrics.desiredRoleVacancyMatches).toBe(0);
    expect(decision.trigger).toBe(true);
    expect(decision.reason).toContain("desired-role");
  });

  it("calls SerpAPI fallback when Tavily recall is insufficient", async () => {
    const { getProviderManager } = await import("@/features/lead-intelligence/providers/manager");
    const executeSingleProviderSearch = vi
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            title: "Indeed listing",
            url: "https://www.indeed.com/viewjob",
            description: "jobboard",
          },
        ],
        durationMs: 10,
        fromCache: false,
        attempt: 1,
      })
      .mockResolvedValueOnce({
        results: [
          {
            title: "Recruiter vacature",
            url: "https://acme.nl/vacatures/recruiter",
            description: "Wij zoeken een recruiter",
          },
        ],
        durationMs: 12,
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
      desiredRoles: basePlan.desired_roles,
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
            resultType: hit.url.includes("acme.nl") ? "individual_vacancy" : "vacancy_board",
          }),
        ),
    });

    expect(executeSingleProviderSearch).toHaveBeenCalledTimes(2);
    expect(result.serpApiFallbackTriggered).toBe(true);
    expect(result.providersUsed).toContain("serpapi");
    expect(result.combinedMetrics.desiredRoleVacancyMatches).toBeGreaterThan(0);
  });

  it("dedupes identical vacancies from Tavily and SerpAPI into one candidate", () => {
    const tavily = makeEnriched({
      url: "https://acme.nl/vacatures/recruiter",
      vacancyUrl: "https://acme.nl/vacatures/recruiter",
      vacancyTitle: "Recruiter",
    });
    const serpapi = makeEnriched({
      url: "https://acme.nl/vacatures/recruiter?utm=serp",
      vacancyUrl: "https://acme.nl/vacatures/recruiter?utm=serp",
      vacancyTitle: "Recruiter",
      vacancySource: "serpapi",
    });

    const merged = mergeEnrichedDiscoveryResults([tavily], [serpapi]);
    expect(merged).toHaveLength(1);
    expect(dedupeEnrichedDiscoveryResults([tavily, serpapi])).toHaveLength(1);
  });

  it("keeps jobboards classified as non-company and not accepted as official employer", () => {
    const classified = classifyDiscoveryResult({
      title: "Recruiter vacatures in Rotterdam",
      url: "https://www.linkedin.com/jobs/search?keywords=recruiter&location=Rotterdam",
      description: "Vacaturebank",
      excludeRecruitmentAgencies: true,
    });

    expect(["vacancy_board", "search_result_page"]).toContain(classified.resultType);
    expect(classified.shouldSaveAsCompany).toBe(false);
  });

  it("keeps strict vacancy URL validation unchanged", () => {
    expect(isCareersListingPath("/vacatures")).toBe(true);
    expect(isCareersListingPath("/careers")).toBe(true);
    expect(hasConcreteJobUrl("https://example.nl/vacatures/recruiter")).toBe(true);
    expect(hasConcreteJobUrl("https://example.nl/vacatures")).toBe(false);
  });
});
