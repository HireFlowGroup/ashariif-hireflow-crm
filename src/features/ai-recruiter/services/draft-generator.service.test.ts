import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { computeOpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import { generateRecruiterOutreachDraft, generateRecruiterFollowUpDraft } from "@/features/ai-recruiter/services/draft-generator.service";

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

describe("generateRecruiterOutreachDraft fallback", () => {
  it("writes personal intro using vacancies and signals, max 180 words", async () => {
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
    expect(draft.bodyText.toLowerCase()).toMatch(/kennismaking|sparren|bellen/);
    expect(draft.bodyText.toLowerCase()).not.toContain("marktleider");
    expect(countWords(draft.bodyText)).toBeLessThanOrEqual(180);
    expect(draft.recommendedSubject.toLowerCase()).not.toContain("recruitment-ondersteuning");
  });
});

describe("generateRecruiterFollowUpDraft fallback", () => {
  it("references previous mail, restates value, one CTA, max 120 words", async () => {
    const c = company();
    const hiring = computeHiringIntelligenceProfile(c, plan);
    const opportunity = computeOpportunityAssessment(c, plan);

    const intro = await generateRecruiterOutreachDraft(
      c,
      { recipientName: "Sanne", email: "sanne@scaleup.nl", isGeneralMailbox: false },
      hiring,
      opportunity,
    );

    const followUp = await generateRecruiterFollowUpDraft(
      c,
      { recipientName: "Sanne", email: "sanne@scaleup.nl", isGeneralMailbox: false },
      hiring,
      { subject: intro.recommendedSubject, bodyText: intro.bodyText },
    );

    expect(followUp.subject).toMatch(/^Re:/i);
    expect(followUp.bodyText.toLowerCase()).toMatch(/eerdere (mail|bericht)/);
    expect(followUp.bodyText.toLowerCase()).toContain("hireflow");
    expect(followUp.bodyText.toLowerCase()).not.toContain("ik wilde even");
    expect(countWords(followUp.bodyText)).toBeLessThanOrEqual(120);
  });
});
