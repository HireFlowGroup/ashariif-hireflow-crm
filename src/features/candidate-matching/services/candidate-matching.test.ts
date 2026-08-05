import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Vacancy } from "@/features/vacancies/domain";
import { toVacancyId } from "@/features/vacancies/domain";
import { computeCandidateMatch } from "@/features/candidate-matching/services/candidate-matcher.service";
import { generateCandidateIntroduction } from "@/features/candidate-matching/services/candidate-intro-generator.service";

const vacancy: Vacancy = {
  id: toVacancyId("v1"),
  organizationId: "org-1",
  companyId: toCompanyId("c1"),
  ownerId: null,
  title: "Senior Software Engineer",
  description: "Bouw aan ons SaaS-platform. Minimaal 5 jaar ervaring met TypeScript en React.",
  location: "Utrecht",
  employmentType: "full_time",
  salaryMin: 70000,
  salaryMax: 90000,
  status: "open",
  requirements: "TypeScript, React, Node.js, 5+ jaar ervaring",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const strongCandidate = {
  firstName: "Lisa",
  lastName: "Jansen",
  candidateCurrentRole: "Senior Frontend Developer",
  location: "Utrecht",
  summary: "8 jaar ervaring met React en TypeScript in scale-ups.",
  skills: ["TypeScript", "React", "Node.js"],
  experienceYears: 8,
  salaryExpectationMin: 75000,
  salaryExpectationMax: 85000,
  availability: "Per direct, 1 maand opzegtermijn",
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

describe("computeCandidateMatch", () => {
  it("scores strong fit with breakdown and honest risks", () => {
    const match = computeCandidateMatch(vacancy, strongCandidate);

    expect(match.matchScore).toBeGreaterThanOrEqual(70);
    expect(match.strongPoints.length).toBeGreaterThan(0);
    expect(match.breakdown.skillsFit).toBeGreaterThan(10);
    expect(match.salaryExpectation).toContain("€");
    expect(match.availability).toContain("direct");
    expect(match.confidence).toBeGreaterThan(0.5);
  });

  it("flags salary and location risks for weak fit", () => {
    const match = computeCandidateMatch(vacancy, {
      firstName: "Tom",
      lastName: "Bakker",
      candidateCurrentRole: "Accountmanager",
      location: "Groningen",
      skills: ["Sales"],
      experienceYears: 2,
      salaryExpectationMin: 110000,
      availability: null,
    });

    expect(match.matchScore).toBeLessThan(50);
    expect(match.risks.some((r) => /salaris|locatie|ervaring/i.test(r))).toBe(true);
    expect(match.missingInfo).toContain("beschikbaarheid");
  });
});

describe("generateCandidateIntroduction", () => {
  it("writes honest client intro max 150 words", async () => {
    const match = computeCandidateMatch(vacancy, strongCandidate);
    const intro = await generateCandidateIntroduction(
      vacancy,
      strongCandidate,
      match,
      "ScaleUp BV",
    );

    expect(intro.bodyText).toContain("Lisa");
    expect(intro.bodyText.toLowerCase()).not.toContain("perfecte kandidaat");
    expect(countWords(intro.bodyText)).toBeLessThanOrEqual(150);
    expect(intro.bodyText.toLowerCase()).toMatch(/gesprek|kennismak/);
  });
});
