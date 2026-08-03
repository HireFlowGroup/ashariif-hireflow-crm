import { describe, expect, it } from "vitest";

import { computeLeadScore } from "@/features/lead-scoring/services/lead-scoring-engine.service";
import type { LeadScoreInput } from "@/features/lead-scoring/domain/lead-score.types";

const baseInput = (overrides: Partial<LeadScoreInput> = {}): LeadScoreInput => ({
  name: "Acme BV",
  sector: "IT-dienstverlening",
  city: "Amsterdam",
  region: "Noord-Holland",
  website: "https://acme.nl",
  domain: "acme.nl",
  linkedinUrl: "https://linkedin.com/company/acme",
  email: "info@acme.nl",
  generalEmail: "info@acme.nl",
  hrEmail: "hr@acme.nl",
  phone: "+31 20 1234567",
  careersUrl: "https://acme.nl/werken-bij",
  vacancyPageUrl: null,
  kvkNumber: "12345678",
  vacancyCount: 3,
  vacancyTitles: ["HR Manager", "Recruiter"],
  hiringSignals: [
    { type: "vacancy", description: "HR vacature", confidence: 0.9 },
    { type: "ats_detected", description: "Greenhouse", confidence: 0.85 },
  ],
  confidence: 0.8,
  source: "Indeed",
  criteria: {
    sector: "IT-dienstverlening",
    city: "Amsterdam",
    region: "Noord-Holland",
  },
  ...overrides,
});

describe("computeLeadScore", () => {
  it("is deterministic for identical input", () => {
    const a = computeLeadScore(baseInput());
    const b = computeLeadScore(baseInput());
    expect(a.score).toBe(b.score);
    expect(a.priority).toBe(b.priority);
    expect(a.components).toEqual(b.components);
  });

  it("assigns priority B or C to strong hiring signals", () => {
    const result = computeLeadScore(baseInput());
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(["A", "B", "C"]).toContain(result.priority);
    expect(result.components.recruitmentActivity).toBeGreaterThan(50);
  });

  it("assigns priority D to weak profiles", () => {
    const result = computeLeadScore(
      baseInput({
        website: null,
        domain: null,
        linkedinUrl: null,
        email: null,
        hrEmail: null,
        phone: null,
        careersUrl: null,
        vacancyCount: 0,
        vacancyTitles: [],
        hiringSignals: [],
        confidence: 0.2,
        criteria: undefined,
      }),
    );

    expect(result.priority).toBe("D");
    expect(result.score).toBeLessThan(50);
  });

  it("returns all eight components via priority engine", () => {
    const result = computeLeadScore(baseInput());
    expect(Object.keys(result.components)).toHaveLength(8);
    expect(result.weightedComponents).toHaveLength(8);
    expect(result.priorityProfile).toBeDefined();
  });
});
