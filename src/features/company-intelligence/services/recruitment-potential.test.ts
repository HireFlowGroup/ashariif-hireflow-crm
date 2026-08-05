import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import {
  assessRecruitmentPotentialFromCompany,
} from "@/features/company-intelligence/services/recruitment-potential.service";

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

describe("assessRecruitmentPotentialFromCompany", () => {
  it("returns HIGH for multi-vacancy growth company without internal recruiter", () => {
    const result = assessRecruitmentPotentialFromCompany(
      company({
        vacancyCount: 4,
        careersUrl: "https://scaleup.nl/werken-bij",
        hiringSignals: [
          { type: "funding", description: "Series B investering", source: "web", confidence: 0.9 },
          { type: "linkedin_hiring", description: "We're hiring engineers", source: "linkedin", confidence: 0.8 },
          { type: "new_location", description: "Nieuw kantoor Amsterdam", source: "news", confidence: 0.7 },
        ],
      }),
    );

    expect(result.recruitmentPotential).toBe("HIGH");
    expect(countWords(result.motivation)).toBeLessThanOrEqual(120);
    expect(result.findings.some((f) => f.dimension === "vacancies" && f.detected)).toBe(true);
    expect(result.findings.some((f) => f.dimension === "investments" && f.detected)).toBe(true);
  });

  it("returns LOW for company without hiring signals", () => {
    const result = assessRecruitmentPotentialFromCompany(company());
    expect(result.recruitmentPotential).toBe("LOW");
  });

  it("lowers potential when recruitment partner is visible", () => {
    const withPartner = assessRecruitmentPotentialFromCompany(
      company({
        vacancyCount: 2,
        hiringSignals: [
          { type: "vacancy", description: "Werkt met Randstad recruitment partner", source: "web", confidence: 0.8 },
        ],
      }),
    );
    const withoutPartner = assessRecruitmentPotentialFromCompany(
      company({
        vacancyCount: 2,
        hiringSignals: [
          { type: "vacancy", description: "Open developer vacature", source: "web", confidence: 0.8 },
        ],
      }),
    );

    expect(withPartner.score).toBeLessThan(withoutPartner.score);
  });
});

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
