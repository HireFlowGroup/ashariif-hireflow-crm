import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { computeLeadScore } from "@/features/ai-recruiter/services/lead-scoring.service";
import {
  classifyReply,
  getReplyFollowUpAction,
} from "@/features/ai-recruiter/services/reply-classifier.service";
import { searchPlanToCompanyFinderCriteria } from "@/features/ai-recruiter/services/search-plan-parser.service";
import { inferUrlCategoryHeuristic } from "@/features/company-finder/discovery/discovery-heuristics";
import {
  findDuplicateRecipient,
  isValidEmail,
  selectRecipient,
  type OutreachContactRecord,
} from "@/features/outreach-engine/services/recipient-selection.service";

const basePlan = aiRecruiterSearchPlanSchema.parse({
  locations: ["Rotterdam"],
  sectors: ["Software en SaaS"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiter"],
  maximum_companies: 25,
  maximum_drafts: 10,
  minimum_hiring_score: 40,
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
    vacancyCount: 3,
    hiringSignals: [{ type: "vacancy", description: "3 recruiter vacatures", source: "web", confidence: 0.9 }],
    careersUrl: "https://techco.nl/werken-bij",
    vacancyPageUrl: null,
    generalEmail: null,
    hrEmail: "hr@techco.nl",
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

describe("AI Recruiter search plan", () => {
  it("parses valid structured plan", () => {
    const plan = aiRecruiterSearchPlanSchema.parse({
      locations: ["Rotterdam", "Den Haag"],
      desired_roles: ["recruiter"],
      maximum_companies: 25,
      maximum_drafts: 10,
    });
    expect(plan.maximum_companies).toBe(25);
    expect(plan.approval_mode).toBe("manual");
    expect(plan.outreach_mode).toBe("draft_only");
  });

  it("maps plan to company finder criteria", () => {
    const criteria = searchPlanToCompanyFinderCriteria(basePlan, "test prompt");
    expect(criteria.city).toBe("Rotterdam");
    expect(criteria.maxResults).toBe(25);
    expect(criteria.fastMode).toBe(true);
  });
});

describe("AI Recruiter hiring intelligence", () => {
  it("scores company with multiple vacancies highly", () => {
    const profile = computeHiringIntelligenceProfile(company(), basePlan);
    expect(profile.hiringScore).toBeGreaterThanOrEqual(40);
    expect(profile.explanations.length).toBeGreaterThan(0);
  });

  it("warns when vacancies required but missing", () => {
    const profile = computeHiringIntelligenceProfile(
      company({ vacancyCount: 0, hiringSignals: [] }),
      { ...basePlan, vacancy_required: true },
    );
    expect(profile.warnings.some((w) => w.includes("Vacature"))).toBe(true);
  });
});

describe("AI Recruiter lead scoring", () => {
  it("assigns transparent score with explanations", () => {
    const hiring = computeHiringIntelligenceProfile(company(), basePlan);
    const result = computeLeadScore(
      company(),
      hiring,
      {
        hasContact: true,
        contactName: "Jan Jansen",
        contactEmail: "jan@techco.nl",
        verificationStatus: "likely",
        confidence: 0.8,
      },
      basePlan,
    );
    expect(result.totalScore).toBeGreaterThan(40);
    expect(result.breakdown.explanations.length).toBeGreaterThan(0);
    expect(["A", "B", "C"]).toContain(result.priority);
  });

  it("rejects low score companies", () => {
    const hiring = computeHiringIntelligenceProfile(
      company({ vacancyCount: 0, hiringSignals: [], sector: null, city: null }),
      basePlan,
    );
    const result = computeLeadScore(
      company({ vacancyCount: 0, hiringSignals: [], sector: null, city: null }),
      hiring,
      { hasContact: false, contactName: null, contactEmail: null, verificationStatus: "unknown", confidence: null },
      basePlan,
    );
    expect(result.priority).toBe("Reject");
  });
});

describe("Discovery validation integration", () => {
  it("rejects article URLs", () => {
    const category = inferUrlCategoryHeuristic({
      url: "https://example.com/article/top-250-bedrijven-rotterdam",
      title: "Top 250 bedrijven in Rotterdam",
      snippet: "Overzicht artikel",
    });
    expect(category).not.toBe("company");
  });

  it("accepts likely company URLs", () => {
    const category = inferUrlCategoryHeuristic({
      url: "https://techco.nl/over-ons",
      title: "TechCo BV — Over ons",
      snippet: "Software bedrijf Rotterdam",
    });
    expect(["company", "unknown"]).toContain(category);
  });
});

describe("AI Recruiter contact & outreach rules", () => {
  const hrContact: OutreachContactRecord = {
    id: "ct1",
    firstName: "Jan",
    lastName: "Jansen",
    jobTitle: "HR Manager",
    email: "jan@techco.nl",
    confidence: 0.9,
    outreachOptOut: false,
  };

  it("blocks when no contact", () => {
    const result = selectRecipient({
      company: company({ hrEmail: null, domain: null }),
      contacts: [],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(),
      recentlyContactedCompanyIds: new Set(),
    });
    expect(result.ok).toBe(false);
  });

  it("blocks invalid email", () => {
    expect(isValidEmail("bad")).toBe(false);
  });

  it("blocks opt-out", () => {
    const result = selectRecipient({
      company: company({ outreachOptOut: true }),
      contacts: [hrContact],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(),
      recentlyContactedCompanyIds: new Set(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("opt_out");
  });

  it("blocks duplicate recipient", () => {
    expect(findDuplicateRecipient("jan@techco.nl", new Set(["jan@techco.nl"]))).toBe(true);
  });
});

describe("AI Recruiter reply classification", () => {
  it("classifies positive reply", () => {
    expect(classifyReply("Re: Kennismaking", "Graag een afspraak volgende week")).toBe("positive");
  });

  it("classifies unsubscribe", () => {
    expect(classifyReply(null, "Please unsubscribe me")).toBe("unsubscribe");
  });

  it("classifies bounce", () => {
    expect(classifyReply("Delivery failed", "Undeliverable")).toBe("bounce");
  });

  it("creates follow-up task for positive", () => {
    const action = getReplyFollowUpAction("positive");
    expect(action.createTask).toBe(true);
    expect(action.pipelineStage).toBe("replied_positive");
  });

  it("adds suppression for unsubscribe", () => {
    const action = getReplyFollowUpAction("unsubscribe");
    expect(action.addSuppression).toBe(true);
  });
});
