import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Vacancy } from "@/features/vacancies/domain";
import { toVacancyId } from "@/features/vacancies/domain";
import { buildCandidateDiscoveryQueryPlan } from "@/features/candidate-discovery/services/candidate-discovery-query-builder.service";

const baseVacancy: Vacancy = {
  id: toVacancyId("00000000-0000-4000-8000-000000000001"),
  organizationId: "org-1",
  companyId: toCompanyId("00000000-0000-4000-8000-000000000002"),
  ownerId: null,
  title: "Senior Software Engineer",
  description: "Bouw features in TypeScript en React.",
  location: "Utrecht",
  employmentType: "full_time",
  salaryMin: null,
  salaryMax: null,
  status: "open",
  requirements: "TypeScript, React, Node.js, 5+ jaar ervaring",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("buildCandidateDiscoveryQueryPlan", () => {
  it("builds up to three site:linkedin.com/in queries with title, skills and location", () => {
    const plan = buildCandidateDiscoveryQueryPlan(baseVacancy);

    expect(plan.queries.length).toBeGreaterThanOrEqual(2);
    expect(plan.queries.length).toBeLessThanOrEqual(3);
    for (const query of plan.queries) {
      expect(query).toContain("site:linkedin.com/in");
      expect(query).toMatch(/Utrecht|Nederland/);
    }
    expect(plan.skillTerms).toContain("typescript");
  });

  it("throws when vacancy title missing", () => {
    expect(() =>
      buildCandidateDiscoveryQueryPlan({ ...baseVacancy, title: " " }),
    ).toThrow(/Vacaturetitel/);
  });
});