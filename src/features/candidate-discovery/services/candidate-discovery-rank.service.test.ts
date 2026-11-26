import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Vacancy } from "@/features/vacancies/domain";
import { toVacancyId } from "@/features/vacancies/domain";
import { sampleLinkedInSerpHits } from "@/features/candidate-discovery/fixtures/serp-linkedin-samples";
import { buildCandidateDiscoveryQueryPlan } from "@/features/candidate-discovery/services/candidate-discovery-query-builder.service";
import { rankCandidateDiscoveryResults } from "@/features/candidate-discovery/services/candidate-discovery-rank.service";

const vacancy: Vacancy = {
  id: toVacancyId("00000000-0000-4000-8000-000000000001"),
  organizationId: "org-1",
  companyId: toCompanyId("00000000-0000-4000-8000-000000000002"),
  ownerId: null,
  title: "Senior Software Engineer",
  description: "TypeScript en React in Utrecht.",
  location: "Utrecht",
  employmentType: "full_time",
  salaryMin: 70000,
  salaryMax: 90000,
  status: "open",
  requirements: "TypeScript, React, Node.js",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("rankCandidateDiscoveryResults", () => {
  it("returns at most 5 proposals with rationale and min score", () => {
    const plan = buildCandidateDiscoveryQueryPlan(vacancy);
    const outcome = {
      attempts: [
        {
          query: plan.queries[0]!,
          success: true,
          resultCount: sampleLinkedInSerpHits.length,
          durationMs: 100,
          providerId: "tavily",
        },
      ],
      items: sampleLinkedInSerpHits,
      providerFailures: 0,
      allQueriesFailed: false,
    };

    const ranked = rankCandidateDiscoveryResults({
      vacancy,
      queryPlan: plan,
      searchOutcome: outcome,
      minMatchScore: 45,
      maxCandidates: 5,
    });

    expect(ranked.proposals.length).toBeLessThanOrEqual(5);
    for (const proposal of ranked.proposals) {
      expect(proposal.match.matchScore).toBeGreaterThanOrEqual(45);
      expect(proposal.matchRationale.length).toBeGreaterThan(0);
      expect(proposal.matchRationale[0]).toMatch(/Score \d+\/100/);
      expect(proposal.sourceProvider).toBeTruthy();
    }
    expect(ranked.duplicateUrlCount).toBeGreaterThanOrEqual(1);
  });

  it("excludes profiles with only role title and no secondary evidence", () => {
    const onlyRole = {
      title: "Senior Software Engineer | LinkedIn",
      url: "https://www.linkedin.com/in/only-title-no-evidence",
      description: "",
      sourceQuery: "site:linkedin.com/in test",
      sourceProvider: "tavily",
    };
    const plan = buildCandidateDiscoveryQueryPlan(vacancy);
    const outcome = {
      attempts: [{ query: plan.queries[0]!, success: true, resultCount: 1, durationMs: 10, providerId: "tavily" }],
      items: [onlyRole],
      providerFailures: 0,
      allQueriesFailed: false,
    };

    const ranked = rankCandidateDiscoveryResults({
      vacancy,
      queryPlan: plan,
      searchOutcome: outcome,
      minMatchScore: 1,
      maxCandidates: 5,
    });

    expect(ranked.proposals).toHaveLength(0);
    expect(ranked.ineligibleCount).toBe(1);
  });
});