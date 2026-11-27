import { describe, expect, it } from "vitest";

import { buildCandidateSourcingQueryPlan } from "@/features/candidate-discovery/services/candidate-sourcing-query-builder.service";
import { toVacancyId } from "@/features/vacancies/domain";

describe("buildCandidateSourcingQueryPlan", () => {
  const vacancy = {
    id: toVacancyId("00000000-0000-4000-8000-000000000001"),
    organizationId: "org",
    companyId: "company" as never,
    ownerId: null,
    title: "Corporate Recruiter",
    description: "Recruitment in tech",
    location: "Rotterdam",
    employmentType: "full_time" as const,
    salaryMin: null,
    salaryMax: null,
    status: "open" as const,
    requirements: "Talent acquisition, ATS",
    createdAt: "",
    updatedAt: "",
  };

  it("genereert LinkedIn x-ray queries voor Rotterdam recruiters", () => {
    const plan = buildCandidateSourcingQueryPlan({
      vacancy,
      criteria: {
        vacancyId: vacancy.id,
        additionalJobTitles: ["Talent Acquisition Specialist"],
        location: "Rotterdam",
        skills: ["recruitment"],
        naturalLanguageInstructions: "in-house recruiter Rotterdam",
      },
    });

    expect(plan.queries.length).toBeGreaterThan(0);
    expect(plan.queries.length).toBeLessThanOrEqual(3);
    expect(plan.queries.every((q) => /site:linkedin\.com\/in/i.test(q))).toBe(true);
    expect(plan.queries.some((q) => /Rotterdam/i.test(q))).toBe(true);
  });
});