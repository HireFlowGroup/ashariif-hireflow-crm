import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import {
  computeOpportunityAssessment,
  isOutreachEligible,
} from "@/features/ai-recruiter/services/opportunity-scorer.service";

const basePlan = aiRecruiterSearchPlanSchema.parse({
  locations: ["Rotterdam"],
  sectors: ["Software en SaaS"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiter", "software engineer"],
  maximum_companies: 25,
  maximum_drafts: 10,
  minimum_opportunity_score: 70,
});

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("c1"),
    organizationId: "org-1",
    ownerId: null,
    name: "TechCo BV",
    website: "https://techco.nl",
    domain: "techco.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "Software en SaaS",
    city: "Rotterdam",
    region: null,
    province: null,
    country: "NL",
    employeeCount: 80,
    employeeCountMin: 20,
    employeeCountMax: 200,
    employeeCountLabel: null,
    priority: null,
    leadScore: 70,
    leadPriority: "B",
    scoreReason: null,
    scoreBreakdown: null,
    vacancyCount: 0,
    hiringSignals: [],
    careersUrl: null,
    vacancyPageUrl: null,
    generalEmail: null,
    hrEmail: null,
    kvkNumber: null,
    aiSummary: null,
    source: "tavily",
    sourceUrl: null,
    confidence: 0.8,
    companyType: "company",
    companyConfidence: 0.85,
    discoveryReason: "validated",
    discoveryProvider: "tavily",
    lastVerifiedAt: null,
    outreachStatus: "none",
    status: "active",
    notes: null,
    outreachOptOut: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeOpportunityAssessment", () => {
  it("scores high for growing company with multiple stale vacancies", () => {
    const assessment = computeOpportunityAssessment(
      company({
        vacancyCount: 4,
        hiringSignals: [
          { type: "growth", description: "Scale-up met nieuw kantoor", source: "web", confidence: 0.9 },
          { type: "stale_vacancy", description: "Vacature 45 dagen open", source: "web", confidence: 0.8 },
        ],
      }),
      basePlan,
    );

    expect(assessment.opportunityScore).toBeGreaterThanOrEqual(70);
    expect(assessment.agencyNeedLikelihood).toBe("high");
    expect(assessment.urgency).toBe("high");
    expect(assessment.why.length).toBeGreaterThan(0);
    expect(assessment.bestApproach.length).toBeGreaterThan(0);
    expect(isOutreachEligible(assessment.opportunityScore, basePlan)).toBe(true);
  });

  it("scores low when no vacancies and internal recruiter visible", () => {
    const assessment = computeOpportunityAssessment(
      company({
        vacancyCount: 0,
        hiringSignals: [
          { type: "internal_recruiter", description: "Intern recruitment team", source: "web", confidence: 0.9 },
        ],
      }),
      basePlan,
    );

    expect(assessment.opportunityScore).toBeLessThan(70);
    expect(isOutreachEligible(assessment.opportunityScore, basePlan)).toBe(false);
  });

  it("extracts roles sought from plan and signals", () => {
    const assessment = computeOpportunityAssessment(
      company({
        vacancyCount: 2,
        hiringSignals: [
          { type: "vacancy", description: "Zoekt software engineer", source: "web", confidence: 0.9 },
        ],
      }),
      basePlan,
    );

    expect(assessment.rolesSought.some((r) => r.toLowerCase().includes("software engineer"))).toBe(true);
  });
});
