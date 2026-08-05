import { describe, expect, it } from "vitest";

import type { AiEmailWriterInput } from "@/features/ai-email-writer/domain/ai-email-writer.types";
import {
  assembleEmailBody,
  buildEmailWriterContextPayload,
  buildFallbackEmailDraft,
  generateAiEmailDraft,
} from "@/features/ai-email-writer/services/ai-email-writer.service";
import { MAX_EMAIL_WORDS } from "@/features/ai-email-writer/domain/ai-email-writer.types";
import { INSUFFICIENT_DATA } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";

function baseInput(overrides: Partial<AiEmailWriterInput> = {}): AiEmailWriterInput {
  return {
    company: {
      name: "Acme BV",
      website: "https://acme.nl",
      sector: "IT",
      city: "Rotterdam",
    },
    contact: {
      name: "Jane Doe",
      jobTitle: "HR Manager",
      email: "jane@acme.nl",
      isGeneralMailbox: false,
    },
    vacancies: [
      { title: "Senior Developer", location: "Rotterdam", status: "open" },
      { title: "Product Manager", location: "Rotterdam", status: "open" },
    ],
    analysisFacts: {
      company_summary: "Acme BV is een IT-bedrijf in Rotterdam met actieve hiring.",
      why_agency: "2 open vacatures tegelijk invullen.",
      likely_pain_points: "Parallelle hiring zonder extra capaciteit.",
      why_hireflow: "HireFlow kan flexibel opschalen bij hiringpieken.",
      hard_to_fill_roles: "Senior Developer, Product Manager",
      urgency_rationale: "Recent 2 vacatures gepubliceerd.",
      opportunity_chance_rationale: "Op basis van 2 open vacatures.",
      likely_decision_maker: "Jane Doe (HR Manager)",
      opening_line: "Ik zag dat Acme BV momenteel 2 open vacatures heeft.",
      recommended_cta: "Past een kort gesprek van 15 minuten volgende week?",
      recruitment_opportunity_score: 65,
      opportunity_tier: "interessant",
    },
    salutation: "Beste Jane,",
    ...overrides,
  };
}

describe("buildEmailWriterContextPayload", () => {
  it("includes analysis facts and vacancies", () => {
    const payload = buildEmailWriterContextPayload(baseInput());
    expect(payload).toContain("Acme BV");
    expect(payload).toContain("Senior Developer");
    expect(payload).toContain("Waarom recruitmentbureau");
  });
});

describe("buildFallbackEmailDraft", () => {
  it("respects max word limit", () => {
    const draft = buildFallbackEmailDraft(baseInput());
    expect(draft.wordCount).toBeLessThanOrEqual(MAX_EMAIL_WORDS);
    expect(draft.subject.length).toBeGreaterThan(0);
    expect(draft.bodyText).toContain("HireFlow Group");
  });

  it("does not offer candidates", () => {
    const draft = buildFallbackEmailDraft(baseInput());
    expect(draft.bodyText.toLowerCase()).not.toContain("kandidaten");
    expect(draft.bodyText.toLowerCase()).not.toContain("cv");
  });

  it("uses insufficient data when analysis empty", () => {
    const draft = buildFallbackEmailDraft(
      baseInput({
        analysisFacts: {
          company_summary: INSUFFICIENT_DATA,
          why_agency: INSUFFICIENT_DATA,
          likely_pain_points: INSUFFICIENT_DATA,
          why_hireflow: INSUFFICIENT_DATA,
          hard_to_fill_roles: INSUFFICIENT_DATA,
          urgency_rationale: INSUFFICIENT_DATA,
          opportunity_chance_rationale: INSUFFICIENT_DATA,
          likely_decision_maker: INSUFFICIENT_DATA,
          opening_line: INSUFFICIENT_DATA,
          recommended_cta: INSUFFICIENT_DATA,
          recruitment_opportunity_score: null,
          opportunity_tier: null,
        },
      }),
    );
    expect(draft.observedSituation).toBe(INSUFFICIENT_DATA);
  });
});

describe("assembleEmailBody", () => {
  it("joins all sections", () => {
    const body = assembleEmailBody({
      subject: "Test",
      personalIntroduction: "Beste Jane,",
      observedSituation: "2 vacatures open.",
      whyHireFlow: "Flexibele support.",
      callToAction: "Past een gesprek?",
      closing: "Met vriendelijke groet,\nHireFlow Group",
    });
    expect(body).toContain("2 vacatures open.");
    expect(body).toContain("Flexibele support.");
  });
});

describe("generateAiEmailDraft", () => {
  it("returns fallback without OpenAI", async () => {
    const draft = await generateAiEmailDraft(baseInput());
    expect(draft.wordCount).toBeGreaterThan(0);
    expect(draft.personalIntroduction).toContain("Jane");
  });
});
