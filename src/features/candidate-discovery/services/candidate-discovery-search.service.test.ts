import { describe, expect, it, vi } from "vitest";

import { CandidateDiscoveryError } from "@/features/candidate-discovery/domain/candidate-discovery.errors";
import { runCandidateDiscoverySearch } from "@/features/candidate-discovery/services/candidate-discovery-search.service";

describe("runCandidateDiscoverySearch", () => {
  it("aggregates attributed results from successful queries", async () => {
    const executor = vi.fn(async () => ({
      results: [
        {
          title: "A - Engineer",
          url: "https://www.linkedin.com/in/a",
          description: "TypeScript Utrecht",
        },
      ],
      meta: {
        providerId: "tavily",
        durationMs: 50,
        responseSize: 1,
        fromCache: false,
        attempt: 1,
        fallbackUsed: false,
        fallbacksAttempted: [],
      },
    }));

    const outcome = await runCandidateDiscoverySearch({
      queries: ["site:linkedin.com/in engineer Utrecht", "site:linkedin.com/in react Utrecht"],
      executor,
    });

    expect(executor).toHaveBeenCalledTimes(2);
    expect(outcome.items).toHaveLength(2);
    expect(outcome.items[0]!.sourceQuery).toContain("site:linkedin.com/in");
    expect(outcome.allQueriesFailed).toBe(false);
    expect(outcome.providerFailures).toBe(0);
  });

  it("surfaces provider failures instead of silent empty success", async () => {
    const executor = vi.fn(async () => {
      throw new CandidateDiscoveryError("provider_quota", "Tavily quota bereikt");
    });

    const outcome = await runCandidateDiscoverySearch({
      queries: ["q1", "q2"],
      executor,
    });

    expect(outcome.items).toHaveLength(0);
    expect(outcome.providerFailures).toBe(2);
    expect(outcome.allQueriesFailed).toBe(true);
    expect(outcome.attempts[0]!.success).toBe(false);
    expect(outcome.attempts[0]!.errorCode).toBe("provider_quota");
    expect(outcome.attempts[0]!.errorMessage).toContain("quota");
  });

  it("records partial success when one query fails", async () => {
    let call = 0;
    const executor = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        throw new Error("HTTP 503");
      }
      return {
        results: [{ title: "B", url: "https://www.linkedin.com/in/b", description: "React" }],
        meta: {
          providerId: "serpapi",
          durationMs: 40,
          responseSize: 1,
          fromCache: false,
          attempt: 1,
          fallbackUsed: true,
          fallbacksAttempted: ["tavily"],
        },
      };
    });

    const outcome = await runCandidateDiscoverySearch({ queries: ["q1", "q2"], executor });

    expect(outcome.providerFailures).toBe(1);
    expect(outcome.allQueriesFailed).toBe(false);
    expect(outcome.items).toHaveLength(1);
    expect(outcome.attempts[0]!.errorCode).toBe("provider_failure");
  });
});