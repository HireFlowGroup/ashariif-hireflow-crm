import { describe, expect, it } from "vitest";

import {
  computeOpportunityTier,
  finalizeRecruitmentAnalysis,
  opportunityTierEmoji,
  opportunityTierLabel,
} from "@/features/recruitment-intelligence/domain/recruitment-opportunity.helpers";
import { INSUFFICIENT_DATA } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import {
  emptyRecruitmentIntelligenceAnalysis,
  parseRecruitmentIntelligenceAnalysis,
} from "@/features/recruitment-intelligence/domain/recruitment-intelligence.schema";
import { buildFallbackRecruitmentIntelligence } from "@/features/recruitment-intelligence/services/recruitment-intelligence-generator.service";
import type { RecruitmentIntelligenceInput } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";

function baseInput(): RecruitmentIntelligenceInput {
  return {
    organizationId: "org-1",
    companyId: "company-1",
    runItemId: null,
    companyName: "Acme BV",
    website: "https://acme.nl",
    domain: "acme.nl",
    linkedinUrl: null,
    sector: "IT",
    city: "Rotterdam",
    region: "Zuid-Holland",
    employeeLabel: "50–200 medewerkers",
    vacancies: [
      {
        id: "vac-1",
        title: "Senior Developer",
        status: "open",
        location: "Rotterdam",
        createdAt: "2026-08-01T10:00:00.000Z",
      },
    ],
    signals: [],
    contacts: [],
    inputFingerprint: "fp",
  };
}

describe("recruitment opportunity helpers", () => {
  it("maps score to tier bands", () => {
    expect(computeOpportunityTier(85)).toBe("warm");
    expect(computeOpportunityTier(70)).toBe("warm");
    expect(computeOpportunityTier(55)).toBe("interessant");
    expect(computeOpportunityTier(40)).toBe("interessant");
    expect(computeOpportunityTier(20)).toBe("lage_kans");
    expect(computeOpportunityTier(null)).toBeNull();
  });

  it("labels tiers for UI", () => {
    expect(opportunityTierEmoji("warm")).toBe("🟢");
    expect(opportunityTierLabel("interessant")).toBe("Interessant");
  });
});

describe("recruitment-intelligence schema v2", () => {
  it("returns Onvoldoende informatie defaults", () => {
    const empty = emptyRecruitmentIntelligenceAnalysis();
    expect(empty.why_agency).toBe(INSUFFICIENT_DATA);
    expect(empty.recruitment_opportunity_score).toBeNull();
  });

  it("migrates legacy analysis fields", () => {
    const parsed = parseRecruitmentIntelligenceAnalysis({
      company_summary: "Acme BV",
      hiring_challenges: "2 open vacatures.",
      likely_pain_points: "Hiringdruk.",
      recommended_approach: "Flexibel opschalen.",
      why_now: "Recent hiring.",
      recruitment_probability: 65,
      expected_hiring_volume: "2 vacatures",
      likely_decision_maker: "Jane (HR)",
      recommended_subject: "Even sparren?",
      recommended_cta: "15 min volgende week?",
      urgency_score: 50,
    });

    expect(parsed.why_agency).toBe("2 open vacatures.");
    expect(parsed.recruitment_opportunity_score).toBe(65);
    expect(finalizeRecruitmentAnalysis(parsed).opportunity_tier).toBe("interessant");
  });

  it("builds fallback from vacancies without guessing names", () => {
    const analysis = buildFallbackRecruitmentIntelligence(baseInput());
    expect(analysis.hard_to_fill_roles).toContain("Senior Developer");
    expect(analysis.recruitment_opportunity_score).not.toBeNull();
  });
});
