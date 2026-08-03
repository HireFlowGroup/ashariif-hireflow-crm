import { describe, expect, it } from "vitest";
import { scoreLead, priorityFromScore } from "@/features/lead-intelligence/services/score-lead";
import { baseTestCandidate } from "@/features/lead-intelligence/services/test-fixtures";

const baseCandidate = baseTestCandidate;

describe("scoreLead", () => {
  it("assigns high priority for strong matches", () => {
    const result = scoreLead(baseCandidate, {
      city: "Amsterdam",
      sector: "Software en SaaS",
      searchVacancies: true,
    });

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(["A", "B", "C"]).toContain(result.priority);
    expect(result.scoreReason).toContain("Priority");
  });

  it("assigns low priority for weak matches", () => {
    const result = scoreLead(
      { ...baseCandidate, website: null, email: null, vacancyCount: 0, vacancyTitles: [], sector: "Onbekend" },
      { city: "Rotterdam", sector: "Techniek" },
    );

    expect(["C", "D"]).toContain(result.priority);
  });

  it("maps score ranges to priority including D", () => {
    expect(priorityFromScore(90)).toBe("A");
    expect(priorityFromScore(75)).toBe("B");
    expect(priorityFromScore(55)).toBe("C");
    expect(priorityFromScore(30)).toBe("D");
  });
});
