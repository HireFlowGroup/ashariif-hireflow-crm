import { describe, expect, it } from "vitest";

import { groupTimelineItemsByPeriod } from "@/features/hiring-signals-timeline/domain/group-timeline-periods";
import type { HiringSignalTimelineItem } from "@/features/hiring-signals-timeline/domain/timeline.types";

function item(id: string, occurredAt: string): HiringSignalTimelineItem {
  return {
    id,
    kind: "signal",
    title: id,
    description: null,
    occurredAt,
    source: "Test",
    sourceUrl: null,
    confidence: 0.8,
    aiImpact: 10,
    recruitmentImpact: 20,
  };
}

describe("groupTimelineItemsByPeriod", () => {
  it("groups items into Dutch period labels", () => {
    const now = new Date("2026-08-03T14:00:00.000Z");

    const groups = groupTimelineItemsByPeriod(
      [
        item("today", "2026-08-03T10:00:00.000Z"),
        item("last-week", "2026-07-28T10:00:00.000Z"),
        item("last-month", "2026-07-05T10:00:00.000Z"),
      ],
      now,
    );

    expect(groups.map((group) => group.label)).toEqual(["Vandaag", "Vorige week", "Vorige maand"]);
    expect(groups[0]?.items[0]?.id).toBe("today");
  });
});
