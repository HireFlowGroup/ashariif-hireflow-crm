import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { classifyEmployeeRangeEvidence } from "@/features/ai-recruiter/services/employee-range-evidence.service";

const plan: AiRecruiterSearchPlan = {
  locations: [],
  regions: [],
  sectors: [],
  employee_range: { min: 20, max: 200 },
  desired_roles: [],
  vacancy_required: false,
  minimum_hiring_score: 0,
  minimum_opportunity_score: 0,
  maximum_companies: 3,
  maximum_drafts: 3,
  contact_roles: [],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "",
};

function company(partial: Partial<Company>): Company {
  return {
    id: toCompanyId("c1"),
    organizationId: "o1",
    ownerId: null,
    name: "Test",
    website: null,
    domain: null,
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: null,
    city: null,
    region: null,
    province: null,
    country: null,
    employeeCount: null,
    employeeCountMin: null,
    employeeCountMax: null,
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
    ...partial,
  };
}

describe("classifyEmployeeRangeEvidence", () => {
  it("returns unknown when data missing", () => {
    expect(classifyEmployeeRangeEvidence(company({}), plan)).toBe("unknown");
  });

  it("returns verified when range fits plan", () => {
    expect(
      classifyEmployeeRangeEvidence(
        company({ employeeCountMin: 30, employeeCountMax: 150 }),
        plan,
      ),
    ).toBe("verified");
  });

  it("returns outside_required_range when proven out of band", () => {
    expect(
      classifyEmployeeRangeEvidence(
        company({ employeeCountMin: 500, employeeCountMax: 2000 }),
        plan,
      ),
    ).toBe("outside_required_range");
  });

  it("returns conflicting when min exceeds max", () => {
    expect(
      classifyEmployeeRangeEvidence(
        company({ employeeCountMin: 300, employeeCountMax: 50 }),
        plan,
      ),
    ).toBe("conflicting");
  });
});