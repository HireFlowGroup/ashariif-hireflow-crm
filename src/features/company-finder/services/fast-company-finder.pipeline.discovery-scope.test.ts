import { describe, expect, it } from "vitest";

import { resolvePrimaryDiscoveryProviderFailure } from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";
import type { DiscoveryQueryDiagnostic } from "@/features/company-finder/services/fast-discovery.service";

/** Regression: pipeline completion must read query diagnostics outside the inner discovery try. */
describe("fast-company-finder discovery completion diagnostics", () => {
  it("resolves provider quota failure from persisted query diagnostics", () => {
    const queries: DiscoveryQueryDiagnostic[] = [
      {
        query: "test",
        intent: "role_specific",
        label: "test",
        location: "Rotterdam",
        role: "recruiter",
        rawResultCount: 0,
        uniqueResultCount: 0,
        companyResults: 0,
        vacancyResults: 0,
        directoryResults: 0,
        rejectedResults: 0,
        employerHostedResults: 0,
        concreteVacancyResults: 0,
        desiredRoleVacancyResults: 0,
        provider: "tavily",
        providersUsed: ["tavily"],
        tavilyUsefulRecall: false,
        serpApiFallbackTriggered: true,
        serpApiFallbackReason: "quota",
        serpApiFallbackAttempted: false,
        serpApiFallbackSkipped: false,
        tavilyFailed: true,
        tavilyFailureCode: "provider_rate_limited",
        durationMs: 10,
        error: 'Tavily HTTP 432: {"detail":{"error":"usage limit"}}',
      },
    ];

    const resolved = resolvePrimaryDiscoveryProviderFailure(queries);
    expect(resolved?.code).toBe("provider_rate_limited");
  });

  it("does not throw when query diagnostics are empty", () => {
    expect(() => resolvePrimaryDiscoveryProviderFailure([])).not.toThrow();
    expect(resolvePrimaryDiscoveryProviderFailure([])).toBeNull();
  });
});