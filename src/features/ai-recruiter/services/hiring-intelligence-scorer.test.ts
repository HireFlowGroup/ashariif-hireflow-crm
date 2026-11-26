import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";

const plan: AiRecruiterSearchPlan = {
  locations: ["Rotterdam"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiters"],
  vacancy_required: true,
  minimum_hiring_score: 70,
  minimum_opportunity_score: 70,
  maximum_companies: 3,
  maximum_drafts: 3,
  contact_roles: [],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "",
};

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("c1"),
    organizationId: "o1",
    ownerId: null,
    name: "TechFlow",
    website: "https://techflow.nl",
    domain: "techflow.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "software",
    city: "Rotterdam",
    region: null,
    province: null,
    country: "NL",
    employeeCount: null,
    employeeCountMin: 50,
    employeeCountMax: 120,
    employeeCountLabel: null,
    priority: null,
    leadScore: null,
    leadPriority: null,
    scoreReason: null,
    scoreBreakdown: null,
    vacancyCount: 1,
    hiringSignals: [
      {
        type: "active_vacancy",
        description: "Corporate Recruiter",
        source: "careers_page",
        confidence: 0.9,
      },
    ],
    careersUrl: "https://techflow.nl/vacatures",
    vacancyPageUrl: "https://techflow.nl/vacatures/corporate-recruiter/",
    generalEmail: "hr@techflow.nl",
    hrEmail: null,
    kvkNumber: null,
    aiSummary: null,
    source: null,
    sourceUrl: null,
    confidence: null,
    companyType: null,
    companyConfidence: null,
    discoveryReason: null,
    discoveryProvider: null,
    lastVerifiedAt: null,
    outreachStatus: "none",
    status: "prospect",
    notes: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("computeHiringIntelligenceProfile", () => {
  it("rewards verified vacancy role matches without lowering threshold", () => {
    const profile = computeHiringIntelligenceProfile(company(), plan);
    expect(profile.hiringScore).toBeGreaterThanOrEqual(70);
    expect(profile.breakdown.relevant_roles).toBeGreaterThanOrEqual(25);
  });

  it("stays low when no vacancy or role evidence", () => {
    const profile = computeHiringIntelligenceProfile(
      company({ vacancyCount: 0, hiringSignals: [], careersUrl: null, vacancyPageUrl: null }),
      plan,
    );
    expect(profile.hiringScore).toBeLessThan(70);
  });
});