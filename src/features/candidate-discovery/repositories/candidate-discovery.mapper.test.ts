import { describe, expect, it } from "vitest";

import { sampleLinkedInSerpHits } from "@/features/candidate-discovery/fixtures/serp-linkedin-samples";
import { toCompanyId } from "@/features/companies/domain";
import type { Vacancy } from "@/features/vacancies/domain";
import { toVacancyId } from "@/features/vacancies/domain";
import { buildCandidateDiscoveryQueryPlan } from "@/features/candidate-discovery/services/candidate-discovery-query-builder.service";
import { rankCandidateDiscoveryResults } from "@/features/candidate-discovery/services/candidate-discovery-rank.service";
import {
  buildProposalInsertRows,
  mapProposalRowToDomain,
  mapRunRowToDomain,
} from "@/features/candidate-discovery/repositories/candidate-discovery.mapper";

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

describe("candidate-discovery.mapper", () => {
  it("maps run row with tenant and vacancy ids", () => {
    const row = {
      id: "run-1",
      organization_id: "org-1",
      vacancy_id: vacancy.id,
      created_by: "user-1",
      status: "completed",
      queries: ["q1"],
      query_plan: { queries: ["q1"], vacancyTitle: "Senior Software Engineer", locationHint: "Utrecht", skillTerms: [] },
      search_attempts: [],
      provider_meta: {},
      proposal_count: 2,
      below_threshold_count: 0,
      ineligible_count: 0,
      duplicate_url_count: 0,
      provider_failures: 0,
      min_match_score_used: 45,
      error_code: null,
      error_message: null,
      started_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T00:01:00Z",
      retention_expires_at: "2026-04-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:01:00Z",
    };

    const domain = mapRunRowToDomain(row);
    expect(domain.organizationId).toBe("org-1");
    expect(domain.vacancyId).toBe(vacancy.id);
    expect(domain.retentionExpiresAt).toBe("2026-04-01T00:00:00Z");
  });

  it("builds proposal rows only with normalized linkedin urls", () => {
    const plan = buildCandidateDiscoveryQueryPlan(vacancy);
    const ranked = rankCandidateDiscoveryResults({
      vacancy,
      queryPlan: plan,
      searchOutcome: {
        attempts: [{ query: plan.queries[0]!, success: true, resultCount: 2, durationMs: 10, providerId: "tavily" }],
        items: sampleLinkedInSerpHits.slice(0, 2),
        providerFailures: 0,
        allQueriesFailed: false,
      },
      minMatchScore: 45,
      maxCandidates: 5,
    });

    const rows = buildProposalInsertRows({
      organizationId: "org-1",
      vacancyId: vacancy.id,
      runId: "run-1",
      ranked: ranked.proposals,
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.linkedin_url).toMatch(/linkedin\.com\/in\//);
      expect(row.approval_status).toBe("proposed");
      expect(row.saved_candidate_id).toBeNull();
      expect(Array.isArray(row.match_rationale) && row.match_rationale.length).toBeGreaterThan(0);
    }
  });

  it("maps proposal row with match rationale", () => {
    const row = {
      id: "p1",
      organization_id: "org-1",
      vacancy_id: vacancy.id,
      run_id: "run-1",
      rank: 1,
      linkedin_url: "https://www.linkedin.com/in/lisa",
      linkedin_profile_slug: "lisa",
      first_name: "Lisa",
      last_name: "Jansen",
      candidate_current_role: "Developer",
      location: "Utrecht",
      summary: "snippet",
      skills: ["TypeScript"],
      experience_years: 8,
      unknown_fields: ["email"],
      source_provider: "tavily",
      source_query: "q1",
      serp_title: "Lisa",
      serp_snippet: "snippet",
      match_score: 72,
      match_breakdown: { roleFit: 20, skillsFit: 20, locationFit: 15, experienceFit: 10, salaryFit: 7 },
      match_strong_points: ["skills"],
      match_risks: [],
      match_missing_info: ["email"],
      match_rationale: ["Score 72/100"],
      approval_status: "proposed",
      saved_candidate_id: null,
      reviewed_at: null,
      reviewed_by: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const domain = mapProposalRowToDomain(row);
    expect(domain.matchRationale).toEqual(["Score 72/100"]);
    expect(domain.approvalStatus).toBe("proposed");
  });
});