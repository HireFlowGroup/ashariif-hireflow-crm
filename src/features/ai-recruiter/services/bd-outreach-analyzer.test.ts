import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { analyzeBdOutreachContext, pickVariantIndex } from "@/features/ai-recruiter/services/bd-outreach-analyzer.service";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { computeOpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import { generateRecruiterOutreachDraft } from "@/features/ai-recruiter/services/draft-generator.service";

const plan = aiRecruiterSearchPlanSchema.parse({
  locations: ["Utrecht"],
  sectors: ["SaaS"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["software engineer"],
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
    vacancyCount: 3,
    hiringSignals: [
      { type: "growth", description: "Scale-up opent nieuw kantoor", source: "web", confidence: 0.9 },
      { type: "vacancy", description: "Zoekt software engineer", source: "web", confidence: 0.85 },
    ],
    careersUrl: "https://scaleup.nl/werken-bij",
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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

describe("analyzeBdOutreachContext", () => {
  it("derives agency need, pain and HireFlow rationale from facts", () => {
    const c = company();
    const hiring = computeHiringIntelligenceProfile(c, plan);
    const opportunity = computeOpportunityAssessment(c, plan);

    const analysis = analyzeBdOutreachContext(c, hiring, opportunity);

    expect(analysis.whyAgency).toContain("ScaleUp BV");
    expect(analysis.likelyPain.length).toBeGreaterThan(10);
    expect(analysis.whyHireFlow).toContain("HireFlow");
    expect(analysis.factsUsed).toContain("ScaleUp BV");
    expect(analysis.growthStage).toBeTruthy();
  });
});

describe("pickVariantIndex", () => {
  it("returns stable variant per seed", () => {
    expect(pickVariantIndex("ScaleUp BV", 5)).toBe(pickVariantIndex("ScaleUp BV", 5));
    expect(pickVariantIndex("ScaleUp BV", 5)).not.toBe(pickVariantIndex("Other Co", 5));
  });
});

describe("generateRecruiterOutreachDraft BD fallback", () => {
  it("writes short personal mail with bd analysis and simple yes question", async () => {
    const c = company();
    const hiring = computeHiringIntelligenceProfile(c, plan);
    const opportunity = computeOpportunityAssessment(c, plan);

    const draft = await generateRecruiterOutreachDraft(
      c,
      { recipientName: "Sanne", email: "sanne@scaleup.nl", isGeneralMailbox: false },
      hiring,
      opportunity,
    );

    expect(draft.bodyText).toContain("ScaleUp BV");
    expect(draft.bdAnalysis?.whyAgency).toBeTruthy();
    expect(draft.bodyText.toLowerCase()).not.toContain("marktleider");
    expect(draft.bodyText.toLowerCase()).not.toContain("ik wilde even");
    expect(draft.bodyText.toLowerCase()).toMatch(/15 minuten|kennismak/);
    expect(countWords(draft.bodyText)).toBeLessThanOrEqual(140);
  });

  it("produces different openers for different companies", async () => {
    const hiringA = computeHiringIntelligenceProfile(company(), plan);
    const hiringB = computeHiringIntelligenceProfile(
      company({ id: toCompanyId("c2"), name: "DataWorks NL", vacancyCount: 1 }),
      plan,
    );
    const opp = computeOpportunityAssessment(company(), plan);

    const draftA = await generateRecruiterOutreachDraft(
      company(),
      { recipientName: "A", email: "a@scaleup.nl", isGeneralMailbox: false },
      hiringA,
      opp,
    );
    const draftB = await generateRecruiterOutreachDraft(
      company({ id: toCompanyId("c2"), name: "DataWorks NL" }),
      { recipientName: "B", email: "b@dataworks.nl", isGeneralMailbox: false },
      hiringB,
      opp,
    );

    const openerA = draftA.bodyText.split("\n")[2] ?? "";
    const openerB = draftB.bodyText.split("\n")[2] ?? "";
    expect(openerA).not.toBe(openerB);
  });
});
