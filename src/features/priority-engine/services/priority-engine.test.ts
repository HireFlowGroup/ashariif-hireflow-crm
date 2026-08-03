import { describe, expect, it } from "vitest";

import { computePriority } from "@/features/priority-engine/services/priority-engine.service";
import type { PriorityInput } from "@/features/priority-engine/domain/priority.types";

const baseInput = (overrides: Partial<PriorityInput> = {}): PriorityInput => ({
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
  contactCount: 2,
  contacts: [
    {
      jobTitle: "HR Manager",
      email: "hr@acme.nl",
      phone: null,
      linkedinUrl: "https://linkedin.com/in/hr",
      confidence: 0.9,
    },
    {
      jobTitle: "CEO",
      email: "ceo@acme.nl",
      phone: null,
      linkedinUrl: null,
      confidence: 0.85,
    },
  ],
  criteria: {
    sector: "IT-dienstverlening",
    city: "Amsterdam",
    region: "Noord-Holland",
  },
  ...overrides,
});

describe("computePriority", () => {
  it("is deterministic for identical input", () => {
    const a = computePriority(baseInput());
    const b = computePriority(baseInput());
    expect(a.compositeScore).toBe(b.compositeScore);
    expect(a.priority).toBe(b.priority);
    expect(a.components).toEqual(b.components);
  });

  it("returns all eight priority dimensions with factors", () => {
    const result = computePriority(baseInput());
    expect(Object.keys(result.components)).toHaveLength(8);
    expect(result.details).toHaveLength(8);
    expect(result.details.every((detail) => detail.factors.length > 0)).toBe(true);
  });

  it("scores decision maker availability from contacts", () => {
    const withContacts = computePriority(baseInput());
    const withoutContacts = computePriority(baseInput({ contacts: [], contactCount: 0 }));

    expect(withContacts.components.decisionMakerAvailability).toBeGreaterThan(
      withoutContacts.components.decisionMakerAvailability,
    );
  });

  it("inverts outreach difficulty in effective score", () => {
    const easy = computePriority(
      baseInput({
        hrEmail: "hr@acme.nl",
        phone: "+31",
        linkedinUrl: "https://linkedin.com/company/acme",
        outreachStatus: "none",
      }),
    );
    const hard = computePriority(
      baseInput({
        hrEmail: null,
        generalEmail: null,
        email: null,
        phone: null,
        linkedinUrl: null,
        website: null,
        domain: null,
        contactCount: 0,
        contacts: [],
        outreachStatus: "blocked",
      }),
    );

    expect(easy.components.outreachDifficulty).toBeLessThan(hard.components.outreachDifficulty);
    const easyDetail = easy.details.find((detail) => detail.key === "outreachDifficulty");
    const hardDetail = hard.details.find((detail) => detail.key === "outreachDifficulty");
    expect(easyDetail!.effectiveScore).toBeGreaterThan(hardDetail!.effectiveScore);
  });

  it("assigns priority D to weak profiles", () => {
    const result = computePriority(
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
        contacts: [],
        contactCount: 0,
        confidence: 0.2,
        criteria: undefined,
      }),
    );

    expect(result.priority).toBe("D");
    expect(result.compositeScore).toBeLessThan(50);
  });
});
