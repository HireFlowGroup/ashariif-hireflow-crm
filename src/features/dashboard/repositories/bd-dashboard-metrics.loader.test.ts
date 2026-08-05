import { describe, expect, it } from "vitest";

import type { BdDailyTrendPoint } from "@/features/dashboard/domain/dashboard.types";
import {
  periodConversionRate,
  sumTrendField,
} from "@/features/dashboard/repositories/bd-dashboard-metrics.loader";

function point(overrides: Partial<BdDailyTrendPoint> & Pick<BdDailyTrendPoint, "date">): BdDailyTrendPoint {
  return {
    companiesFound: 0,
    analyzed: 0,
    newContacts: 0,
    draftEmails: 0,
    sentEmails: 0,
    openReplies: 0,
    positiveReplies: 0,
    intakes: 0,
    newVacancies: 0,
    candidatesProposed: 0,
    placements: 0,
    ...overrides,
  };
}

describe("bd dashboard metrics helpers", () => {
  it("sums trend fields across a period", () => {
    const points = [
      point({ date: "2026-08-01", companiesFound: 2, sentEmails: 1 }),
      point({ date: "2026-08-02", companiesFound: 3, sentEmails: 4 }),
    ];

    expect(sumTrendField(points, "companiesFound")).toBe(5);
    expect(sumTrendField(points, "sentEmails")).toBe(5);
  });

  it("computes conversion rate from placements vs companies found", () => {
    const points = [
      point({ date: "2026-08-01", companiesFound: 10, placements: 1 }),
      point({ date: "2026-08-02", companiesFound: 10, placements: 1 }),
    ];

    expect(periodConversionRate(points)).toBe(10);
    expect(periodConversionRate([point({ date: "2026-08-01", companiesFound: 0, placements: 0 })])).toBe(0);
  });
});
