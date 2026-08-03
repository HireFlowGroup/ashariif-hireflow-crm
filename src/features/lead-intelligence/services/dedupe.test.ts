import { describe, expect, it } from "vitest";
import { dedupeCandidates, isExcludedCandidate } from "@/features/lead-intelligence/services/dedupe";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { baseTestCandidate } from "@/features/lead-intelligence/services/test-fixtures";

function candidate(partial: Partial<ExternalCompanyCandidate> & Pick<ExternalCompanyCandidate, "name" | "externalId" | "source">): ExternalCompanyCandidate {
  return {
    ...baseTestCandidate,
    ...partial,
    normalizedName: partial.normalizedName ?? partial.name.toLowerCase(),
  };
}

describe("dedupe", () => {
  it("dedupes by domain", () => {
    const results = dedupeCandidates([
      candidate({ name: "Acme", externalId: "1", source: "test", domain: "acme.nl", confidence: 0.5 }),
      candidate({ name: "Acme BV", externalId: "2", source: "test", domain: "acme.nl", confidence: 0.8 }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.confidence).toBe(0.8);
  });

  it("excludes blocked names", () => {
    const result = isExcludedCandidate(
      candidate({ name: "Blocked Corp", externalId: "1", source: "test" }),
      ["blocked"],
      [],
    );

    expect(result).toBe(true);
  });
});
