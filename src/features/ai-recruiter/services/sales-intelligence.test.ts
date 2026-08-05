import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import {
  computeSalesIntelligence,
  deriveSalesLeadTier,
  isSalesOutreachEligible,
} from "@/features/ai-recruiter/services/sales-intelligence.service";

const plan = aiRecruiterSearchPlanSchema.parse({
  locations: ["Utrecht"],
  sectors: ["SaaS"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["engineer"],
  maximum_companies: 10,
  maximum_drafts: 5,
});

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("c1"),
    organizationId: "org-1",
    ownerId: null,
    name: "ScaleUp BV",
    website: "https://scaleup.nl",
    domain: "scaleup.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "SaaS",
    city: "Utrecht",
    region: null,
    province: null,
    country: "NL",
    employeeCount: 120,
    employeeCountMin: 50,
    employeeCountMax: 200,
    employeeCountLabel: null,
    priority: null,
    leadScore: null,
    leadPriority: null,
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

describe("computeSalesIntelligence", () => {
  it("scores HOT LEAD for high-vacancy growing company", () => {
    const c = company({
      vacancyCount: 4,
      careersUrl: "https://scaleup.nl/werken-bij",
      hiringSignals: [
        { type: "funding", description: "Series B investering", source: "web", confidence: 0.9 },
        { type: "linkedin_hiring", description: "We're hiring", source: "linkedin", confidence: 0.8 },
        { type: "vacancy", description: "Software engineer vacature", source: "web", confidence: 0.85 },
        { type: "stale_vacancy", description: "Vacature 45 dagen open", source: "web", confidence: 0.7 },
      ],
    });
    const hiring = computeHiringIntelligenceProfile(c, plan);
    const sales = computeSalesIntelligence(c, hiring, plan);

    expect(sales.salesScore).toBeGreaterThanOrEqual(80);
    expect(sales.tier).toBe("HOT LEAD");
    expect(sales.why.length).toBeGreaterThanOrEqual(5);
    expect(sales.breakdown.openVacancies).toBe(25);
    expect(isSalesOutreachEligible(sales.tier)).toBe(true);
  });

  it("scores IGNORE for company without signals", () => {
    const c = company();
    const hiring = computeHiringIntelligenceProfile(c, plan);
    const sales = computeSalesIntelligence(c, hiring, plan);

    expect(sales.tier).toBe("IGNORE");
    expect(isSalesOutreachEligible(sales.tier)).toBe(false);
  });

  it("derives tiers at boundaries", () => {
    expect(deriveSalesLeadTier(80)).toBe("HOT LEAD");
    expect(deriveSalesLeadTier(79)).toBe("WARM LEAD");
    expect(deriveSalesLeadTier(70)).toBe("WARM LEAD");
    expect(deriveSalesLeadTier(69)).toBe("FOLLOW");
    expect(deriveSalesLeadTier(50)).toBe("FOLLOW");
    expect(deriveSalesLeadTier(49)).toBe("IGNORE");
  });
});
