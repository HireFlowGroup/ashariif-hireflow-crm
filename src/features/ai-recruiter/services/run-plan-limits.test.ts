import { afterEach, describe, expect, it, vi } from "vitest";

import {
  limitQualifiedDiscoveryCandidatesForPersistence,
  resolveMaximumCompaniesForRun,
  resolveMaximumDraftsForRun,
} from "@/features/ai-recruiter/services/search-plan-limits.service";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";

function basePlan(overrides: Partial<AiRecruiterSearchPlan> = {}): AiRecruiterSearchPlan {
  return {
    locations: ["Rotterdam"],
    regions: [],
    sectors: ["software"],
    employee_range: { min: 20, max: 200 },
    desired_roles: ["recruiter"],
    vacancy_required: true,
    minimum_hiring_score: 70,
    minimum_opportunity_score: 70,
    maximum_companies: 3,
    maximum_drafts: 3,
    contact_roles: ["HR"],
    outreach_mode: "draft_only",
    approval_mode: "manual",
    exclusions: [],
    uncertainties: [],
    reasoning: "",
    ...overrides,
  };
}

function makeQualified(name: string, confidence: number): QualifiedDiscoveryCandidate {
  const website = `https://${name.toLowerCase()}.nl`;
  return {
    candidate: {
      name,
      city: "Rotterdam",
      sector: "software",
      website,
      domain: `${name.toLowerCase()}.nl`,
      region: null,
      province: null,
      source: "serpapi",
      sourceUrl: website,
      externalId: `serpapi:${website}`,
      confidence,
      description: null,
      vacancyCount: 0,
    } as QualifiedDiscoveryCandidate["candidate"],
    companyType: "company_website",
    companyConfidence: confidence,
    discoveryReason: "test",
    discoveryProvider: "serpapi",
    urlCategory: "company",
    homepageSignalCount: 2,
    saveStatus: "company",
  };
}

describe("limitQualifiedDiscoveryCandidatesForPersistence", () => {
  it("caps parallel-qualified companies to maximum_companies", () => {
    const candidates = [
      makeQualified("Alpha", 0.9),
      makeQualified("Beta", 0.85),
      makeQualified("Gamma", 0.8),
      makeQualified("Delta", 0.75),
      makeQualified("Epsilon", 0.7),
      makeQualified("Zeta", 0.65),
      makeQualified("Eta", 0.6),
    ];

    const { toPersist, deferredCount } = limitQualifiedDiscoveryCandidatesForPersistence(candidates, 3);

    expect(toPersist).toHaveLength(3);
    expect(deferredCount).toBe(4);
    expect(toPersist.map((c) => c.candidate.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("prioritizes vacancy role match over raw confidence when capping", () => {
    const lowConfRole = makeQualified("RoleFirst", 0.65);
    lowConfRole.candidate.vacancyTitles = ["Corporate Recruiter"];
    lowConfRole.candidate.vacancyPageUrl = "https://rolefirst.nl/jobs/recruiter/";
    lowConfRole.candidate.vacancyCount = 1;

    const highConf = makeQualified("ConfOnly", 0.99);

    const { toPersist } = limitQualifiedDiscoveryCandidatesForPersistence(
      [highConf, lowConfRole],
      1,
      { locations: ["Rotterdam"], sectors: ["software"], desiredRoles: ["recruiters"] },
    );

    expect(toPersist[0]?.candidate.name).toBe("RoleFirst");
  });

  it("leaves list unchanged when under cap", () => {
    const candidates = [makeQualified("Only", 0.8)];
    const { toPersist, deferredCount } = limitQualifiedDiscoveryCandidatesForPersistence(candidates, 3);
    expect(toPersist).toHaveLength(1);
    expect(deferredCount).toBe(0);
  });
});

describe("resolveMaximum*ForRun", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("respects env ceilings on plan limits", () => {
    vi.stubEnv("AI_RECRUITER_PLAN_LIMIT_MAXIMUM_COMPANIES", "3");
    vi.stubEnv("AI_RECRUITER_PLAN_LIMIT_MAXIMUM_DRAFTS", "3");

    const plan = basePlan({ maximum_companies: 25, maximum_drafts: 10 });
    expect(resolveMaximumCompaniesForRun(plan)).toBe(3);
    expect(resolveMaximumDraftsForRun(plan)).toBe(3);
  });
});