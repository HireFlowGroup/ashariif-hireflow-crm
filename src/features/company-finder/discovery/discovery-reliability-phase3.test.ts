import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  buildLocationCoverageMap,
  buildRoleCoverageMap,
  buildUsableRecallDiagnostics,
  identifyRecallCoverageGaps,
} from "@/features/company-finder/discovery/discovery-run-fallback.service";
import {
  dedupeEnrichedDiscoveryResults,
  mergeEnrichedDiscoveryResults,
} from "@/features/company-finder/discovery/discovery-result-dedupe.service";
import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import {
  evaluateUsefulRecall,
  isConcreteVacancyDiscoveryResult,
  shouldTriggerSerpApiFallback,
} from "@/features/company-finder/discovery/discovery-useful-recall.service";
import { classifyDiscoveryResult } from "@/features/company-finder/discovery/result-classifier.service";
import { evaluateDiscoveryEmployerForSave } from "@/features/company-finder/discovery/discovery-employer-criteria.service";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";

const desiredRoles = ["recruiters", "accountmanagers", "customer success managers"];
const locations = ["Rotterdam", "Den Haag"];
const canonicalRoles = ["recruiter", "accountmanager", "customer success manager"];

function makeEnriched(overrides: Partial<EnrichedDiscoveryResult>): EnrichedDiscoveryResult {
  return {
    title: "Recruiter",
    url: "https://example.nl/vacatures/recruiter",
    description: null,
    query: "recruiter vacature Rotterdam software",
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
    discoveryLocation: "Rotterdam",
    discoveryRole: "recruiter",
    sourceProvider: "tavily",
    ...overrides,
  };
}

function makeRejectedJobboard(overrides: Partial<EnrichedDiscoveryResult> = {}): EnrichedDiscoveryResult {
  return makeEnriched({
    accepted: false,
    officialDomain: null,
    resultType: "vacancy_board",
    url: "https://www.indeed.com/viewjob?id=123",
    vacancyTitle: "Recruiter",
    vacancyUrl: "https://www.indeed.com/viewjob?id=123",
    sourceProvider: "tavily",
    ...overrides,
  });
}

describe("discovery reliability phase 3 — usable-recall fallback", () => {
  it("triggers SerpAPI when Tavily has 100 raw hits but 0 usable vacancies", () => {
    const rejectedBatch = Array.from({ length: 100 }, (_, index) =>
      makeRejectedJobboard({
        url: `https://www.indeed.com/viewjob?id=${index}`,
        vacancyUrl: `https://www.indeed.com/viewjob?id=${index}`,
      }),
    );

    const metrics = evaluateUsefulRecall(rejectedBatch, desiredRoles, 100);
    expect(metrics.rawHitCount).toBe(100);
    expect(metrics.usableEmployerProspects).toBe(0);

    const decision = shouldTriggerSerpApiFallback(metrics, {
      serpApiAvailable: true,
      tavilyFailed: false,
      vacancyFocusedQuery: true,
    });

    expect(decision.trigger).toBe(true);
    expect(decision.reason).toContain("concrete");
  });

  it("does not trigger SerpAPI when Tavily has sufficient usable downstream recall", () => {
    const metrics = evaluateUsefulRecall(
      [
        makeEnriched({
          discoveryLocation: "Rotterdam",
          discoveryRole: "recruiter",
        }),
        makeEnriched({
          url: "https://other.nl/vacatures/accountmanager",
          vacancyUrl: "https://other.nl/vacatures/accountmanager",
          vacancyTitle: "Accountmanager",
          title: "Accountmanager",
          officialDomain: "other.nl",
          extractedCompanyName: "Other BV",
          extractedEmployer: "Other BV",
          discoveryLocation: "Den Haag",
          discoveryRole: "accountmanager",
        }),
      ],
      desiredRoles,
      20,
    );

    expect(metrics.usableEmployerProspects).toBeGreaterThan(0);
    expect(
      shouldTriggerSerpApiFallback(metrics, {
        serpApiAvailable: true,
        tavilyFailed: false,
        vacancyFocusedQuery: true,
        skipWhenUsable: true,
      }).trigger,
    ).toBe(false);
  });
});

describe("discovery reliability phase 3 — location-aware fallback", () => {
  it("identifies Den Haag gap when Rotterdam has usable results but Den Haag has none", () => {
    const enriched = [
      makeEnriched({
        discoveryLocation: "Rotterdam",
        discoveryRole: "recruiter",
        query: "recruiter vacature Rotterdam software",
      }),
      makeEnriched({
        discoveryLocation: "Rotterdam",
        discoveryRole: "accountmanager",
        vacancyTitle: "Accountmanager",
        title: "Accountmanager",
        url: "https://rotterdam.nl/vacatures/accountmanager",
        vacancyUrl: "https://rotterdam.nl/vacatures/accountmanager",
        officialDomain: "rotterdam.nl",
        extractedCompanyName: "Rotterdam BV",
        extractedEmployer: "Rotterdam BV",
        query: "accountmanager vacature Rotterdam software",
      }),
    ];

    const locationCoverage = buildLocationCoverageMap(enriched, locations, desiredRoles);
    expect(locationCoverage.Rotterdam).toBeGreaterThan(0);
    expect(locationCoverage["Den Haag"]).toBe(0);

    const gaps = identifyRecallCoverageGaps({
      enriched,
      locations,
      canonicalRoles,
      desiredRoles,
    });

    expect(gaps.some((gap) => gap.location === "Den Haag")).toBe(true);
  });
});

describe("discovery reliability phase 3 — role coverage diagnostics", () => {
  it("reports recruiter surplus without masking missing AM/CSM coverage", () => {
    const enriched = [
      makeEnriched({ discoveryRole: "recruiter" }),
      makeEnriched({
        url: "https://a.nl/vacatures/recruiter-2",
        vacancyUrl: "https://a.nl/vacatures/recruiter-2",
        officialDomain: "a.nl",
        extractedCompanyName: "A BV",
        extractedEmployer: "A BV",
        discoveryRole: "recruiter",
      }),
      makeEnriched({
        url: "https://b.nl/vacatures/recruiter-3",
        vacancyUrl: "https://b.nl/vacatures/recruiter-3",
        officialDomain: "b.nl",
        extractedCompanyName: "B BV",
        extractedEmployer: "B BV",
        discoveryRole: "recruiter",
      }),
    ];

    const roleCoverage = buildRoleCoverageMap(enriched, canonicalRoles, desiredRoles);
    expect(roleCoverage.recruiter).toBeGreaterThan(0);
    expect(roleCoverage.accountmanager).toBe(0);
    expect(roleCoverage["customer success manager"]).toBe(0);

    const gaps = identifyRecallCoverageGaps({
      enriched,
      locations,
      canonicalRoles,
      desiredRoles,
    });
    expect(gaps.some((gap) => gap.role === "accountmanager")).toBe(true);
    expect(gaps.some((gap) => gap.role === "customer success manager")).toBe(true);
  });
});

describe("discovery reliability phase 3 — cross-provider dedup and strict validation", () => {
  it("dedupes identical employer vacancy from Tavily and SerpAPI", () => {
    const tavily = makeEnriched({
      sourceProvider: "tavily",
      url: "https://acme.nl/vacatures/recruiter",
      vacancyUrl: "https://acme.nl/vacatures/recruiter",
    });
    const serpapi = makeEnriched({
      sourceProvider: "serpapi",
      url: "https://acme.nl/vacatures/recruiter?src=serp",
      vacancyUrl: "https://acme.nl/vacatures/recruiter?src=serp",
    });

    const merged = mergeEnrichedDiscoveryResults([tavily], [serpapi]);
    expect(merged).toHaveLength(1);
    expect(dedupeEnrichedDiscoveryResults([tavily, serpapi])).toHaveLength(1);
  });

  it("rejects SerpAPI jobboard hits via existing strict classification", () => {
    const classified = classifyDiscoveryResult({
      title: "Recruiter vacatures in Rotterdam",
      url: "https://www.linkedin.com/jobs/search?keywords=recruiter&location=Rotterdam",
      description: "Vacaturebank",
      excludeRecruitmentAgencies: true,
    });

    expect(classified.shouldSaveAsCompany).toBe(false);
    expect(["vacancy_board", "search_result_page"]).toContain(classified.resultType);
  });

  it("keeps SerpAPI employer-hosted concrete vacancy available for downstream validation", () => {
    const serpResult = makeEnriched({
      sourceProvider: "serpapi",
      url: "https://acme.nl/vacatures/customer-success-manager",
      vacancyUrl: "https://acme.nl/vacatures/customer-success-manager",
      vacancyTitle: "Customer Success Manager",
      title: "Customer Success Manager",
      discoveryRole: "customer success manager",
      discoveryLocation: "Den Haag",
    });

    expect(isConcreteVacancyDiscoveryResult(serpResult)).toBe(true);
    expect(hasConcreteJobUrl(serpResult.vacancyUrl!)).toBe(true);

    const employerGate = evaluateDiscoveryEmployerForSave({
      name: serpResult.extractedCompanyName!,
      domain: serpResult.officialDomain!,
      url: serpResult.url,
      resultType: serpResult.resultType,
      excludeRecruitmentAgencies: true,
      plan: {
        sectors: ["software"],
        desired_roles: desiredRoles,
        reasoning: "",
      },
    });
    expect(employerGate.acceptable).toBe(true);
  });
});

describe("discovery reliability phase 3 — run diagnostics", () => {
  it("builds explicit TAVILY_* and SERPAPI_* diagnostics after a run", () => {
    const tavilyEnriched = [makeRejectedJobboard()];
    const serpEnriched = [
      makeEnriched({
        sourceProvider: "serpapi",
        discoveryLocation: "Den Haag",
        discoveryRole: "accountmanager",
        vacancyTitle: "Accountmanager",
        title: "Accountmanager",
        url: "https://denhaag.nl/vacatures/accountmanager",
        vacancyUrl: "https://denhaag.nl/vacatures/accountmanager",
        officialDomain: "denhaag.nl",
        extractedCompanyName: "Den Haag BV",
        extractedEmployer: "Den Haag BV",
      }),
    ];
    const combined = dedupeEnrichedDiscoveryResults([...tavilyEnriched, ...serpEnriched]);

    const diagnostics = buildUsableRecallDiagnostics({
      tavilyEnriched,
      combinedEnriched: combined,
      desiredRoles,
      locations,
      canonicalRoles,
      tavilyRawHits: 100,
      serpApiRawHits: 5,
      serpApiFallbackTriggered: true,
      serpApiFallbackReason: "Tavily 100 raw hits maar 0 concrete employer-hosted vacature-URL's",
      serpApiSupplementalQueries: 2,
    });

    expect(diagnostics.TAVILY_RAW).toBe(100);
    expect(diagnostics.TAVILY_USABLE).toBe(0);
    expect(diagnostics.TAVILY_CONCRETE_VACANCIES).toBe(0);
    expect(diagnostics.SERPAPI_FALLBACK_TRIGGERED).toBe(true);
    expect(diagnostics.SERPAPI_FALLBACK_REASON).toContain("concrete");
    expect(diagnostics.SERPAPI_SUPPLEMENTAL_QUERIES).toBe(2);
    expect(diagnostics.SERPAPI_USABLE).toBeGreaterThan(0);
  });
});
