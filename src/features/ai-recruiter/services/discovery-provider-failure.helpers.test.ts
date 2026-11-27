import { describe, expect, it } from "vitest";

import { buildDiscoveryDiagnostics } from "@/features/ai-recruiter/services/discovery-run-diagnostics.service";
import {
  emptyDiscoverySummary,
  resolvePrimaryDiscoveryProviderFailure,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";

const plan = {
  locations: ["Rotterdam"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiter"],
  vacancy_required: true,
  minimum_hiring_score: 70,
  minimum_opportunity_score: 70,
  maximum_companies: 3,
  maximum_drafts: 3,
  contact_roles: ["HR Manager"],
  outreach_mode: "draft_only" as const,
  approval_mode: "manual" as const,
  exclusions: [],
  uncertainties: [],
  reasoning: "test",
} satisfies AiRecruiterSearchPlan;

describe("resolvePrimaryDiscoveryProviderFailure", () => {
  it("returns provider_rate_limited from query diagnostics", () => {
    const resolved = resolvePrimaryDiscoveryProviderFailure([
      {
        tavilyFailureCode: "provider_quota_exhausted",
        error: 'Tavily HTTP 432: {"detail":{"error":"usage limit"}}',
      },
    ]);

    expect(resolved?.code).toBe("provider_quota_exhausted");
    expect(resolved?.message).toMatch(/432|abonnementslimiet/i);
  });
});

describe("buildDiscoveryDiagnostics provider vs empty market", () => {
  it("prefers provider_rate_limited over no_results when lastErrorMessage indicates quota", () => {
    const diagnostics = buildDiscoveryDiagnostics({
      plan,
      job: {
        id: "job-1",
        status: "failed",
        errorMessage: "Geen bedrijven opgeslagen na discovery.",
        foundCount: 0,
        savedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        providerErrors: [],
      } as never,
      summary: {
        ...emptyDiscoverySummary(),
        responseCount: 0,
        providerName: "tavily",
        lastErrorMessage: 'Tavily HTTP 432: {"detail":{"error":"usage limit"}}',
      },
      durationMs: 900,
      validatedCount: 0,
    });

    expect(diagnostics.errorCode).toBe("provider_quota_exhausted");
    expect(diagnostics.errorCode).not.toBe("no_results");
  });
});