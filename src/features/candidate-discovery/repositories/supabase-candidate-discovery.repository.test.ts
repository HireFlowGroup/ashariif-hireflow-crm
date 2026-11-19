import { describe, expect, it, vi } from "vitest";

import { SupabaseCandidateDiscoveryRepository } from "@/features/candidate-discovery/repositories/supabase-candidate-discovery.repository";

function createChainableMock(finalResult: { data: unknown; error: unknown }) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
    single: vi.fn().mockResolvedValue(finalResult),
    then: undefined as unknown,
  };

  chain.then = (resolve: (v: typeof finalResult) => void) => Promise.resolve(finalResult).then(resolve);

  return chain;
}

describe("SupabaseCandidateDiscoveryRepository integrity and tenant scoping", () => {
  it("rejects createRun when vacancy is not visible for organization", async () => {
    const vacancyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = {
      from: vi.fn((table: string) => {
        if (table === "vacancies") return vacancyChain;
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const repo = new SupabaseCandidateDiscoveryRepository(client as never);
    await expect(
      repo.createRun({
        organizationId: "org-a",
        vacancyId: "vac-foreign",
        createdBy: "user-1",
        queries: ["q"],
        queryPlan: { queries: ["q"], vacancyTitle: "T", locationHint: null, skillTerms: [] },
        minMatchScoreUsed: 45,
      }),
    ).rejects.toThrow(/organisatie/);
  });

  it("rejects insertProposals when run vacancy does not match", async () => {
    const runRow = {
      id: "run-1",
      organization_id: "org-a",
      vacancy_id: "vac-a",
      created_by: "user-1",
      status: "completed",
      queries: [],
      query_plan: {},
      search_attempts: [],
      provider_meta: {},
      proposal_count: 0,
      below_threshold_count: 0,
      ineligible_count: 0,
      duplicate_url_count: 0,
      provider_failures: 0,
      min_match_score_used: 45,
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
      retention_expires_at: "2026-12-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const runChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: runRow, error: null }),
    };
    const client = {
      from: vi.fn(() => runChain),
    };

    const repo = new SupabaseCandidateDiscoveryRepository(client as never);
    await expect(
      repo.insertProposals({
        organizationId: "org-a",
        vacancyId: "vac-other",
        runId: "run-1",
        ranked: [],
      }),
    ).rejects.toThrow(/vacature/i);
  });
  it("scopes getRun queries by organization_id", async () => {
    const chain = createChainableMock({ data: null, error: null });
    const client = {
      from: vi.fn(() => chain),
    };

    const repo = new SupabaseCandidateDiscoveryRepository(client as never);
    await repo.getRun("org-a", "run-1");

    expect(client.from).toHaveBeenCalledWith("candidate_discovery_runs");
    expect(chain.eq).toHaveBeenCalledWith("id", "run-1");
    expect(chain.eq).toHaveBeenCalledWith("organization_id", "org-a");
  });

  it("scopes listProposalsByRun by organization_id", async () => {
    const chain = createChainableMock({ data: [], error: null });
    const client = {
      from: vi.fn(() => chain),
    };

    const repo = new SupabaseCandidateDiscoveryRepository(client as never);
    await repo.listProposalsByRun("org-b", "run-2");

    expect(chain.eq).toHaveBeenCalledWith("organization_id", "org-b");
    expect(chain.eq).toHaveBeenCalledWith("run_id", "run-2");
  });

  it("skips duplicate proposals without throwing", async () => {
    const runRow = {
      id: "run-1",
      organization_id: "org-1",
      vacancy_id: "vac-1",
      created_by: "user-1",
      status: "completed",
      queries: [],
      query_plan: {},
      search_attempts: [],
      provider_meta: {},
      proposal_count: 0,
      below_threshold_count: 0,
      ineligible_count: 0,
      duplicate_url_count: 0,
      provider_failures: 0,
      min_match_score_used: 45,
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
      retention_expires_at: "2026-12-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const runChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: runRow, error: null }),
    };
    const insertChain = createChainableMock({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "candidate_discovery_runs") return runChain;
        if (table === "candidate_discovery_proposals") return insertChain;
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const repo = new SupabaseCandidateDiscoveryRepository(client as never);
    const result = await repo.insertProposals({
      organizationId: "org-1",
      vacancyId: "vac-1",
      runId: "run-1",
      ranked: [
        {
          rank: 1,
          linkedinUrl: "https://www.linkedin.com/in/duplicate",
          profile: {
            linkedinUrl: "https://www.linkedin.com/in/duplicate",
            firstName: "Lisa",
            lastName: "Jansen",
            candidateCurrentRole: "Engineer",
            location: "Utrecht",
            summary: "TypeScript",
            skills: ["TypeScript"],
            experienceYears: 5,
            unknownFields: [],
            serpTitle: "Lisa",
            serpSnippet: "TypeScript Utrecht",
            serpUrl: "https://www.linkedin.com/in/duplicate",
          },
          matchInput: {
            firstName: "Lisa",
            lastName: "Jansen",
            skills: ["TypeScript"],
            location: "Utrecht",
          },
          match: {
            matchScore: 70,
            breakdown: { roleFit: 20, skillsFit: 20, locationFit: 15, experienceFit: 10, salaryFit: 5 },
            strongPoints: [],
            risks: [],
            salaryExpectation: "Niet opgegeven",
            availability: "Niet opgegeven",
            missingInfo: [],
            confidence: 0.7,
          },
          matchRationale: ["Score 70/100"],
          sourceQuery: "q1",
          sourceProvider: "tavily",
        },
      ],
    });

    expect(result.inserted).toHaveLength(0);
    expect(result.skippedDuplicates).toBe(1);
  });
});