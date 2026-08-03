import { describe, expect, it } from "vitest";

import type { IntelligenceFeedItem } from "@/features/intelligence-feed/domain/feed.types";
import {
  paginateFeedItems,
  sortFeedItems,
} from "@/features/intelligence-feed/services/merge-feed-items";

function item(id: string, occurredAt: string, priority: string | null = null): IntelligenceFeedItem {
  return {
    id,
    category: "new_company",
    title: id,
    subtitle: null,
    description: null,
    companyId: null,
    companyName: null,
    occurredAt,
    priority,
    score: null,
    scoreDelta: null,
    href: null,
    sourceUrl: null,
    isToday: false,
  };
}

describe("sortFeedItems", () => {
  it("sorts newest first by default", () => {
    const sorted = sortFeedItems(
      [item("a", "2026-08-01T10:00:00.000Z"), item("b", "2026-08-03T10:00:00.000Z")],
      "newest",
    );

    expect(sorted[0]?.id).toBe("b");
  });

  it("sorts by priority", () => {
    const sorted = sortFeedItems(
      [item("b", "2026-08-01T10:00:00.000Z", "B"), item("a", "2026-08-01T10:00:00.000Z", "A")],
      "priority",
    );

    expect(sorted[0]?.id).toBe("a");
  });
});

describe("paginateFeedItems", () => {
  it("returns next cursor when more items exist", () => {
    const result = paginateFeedItems([item("a", "2026-08-03T10:00:00.000Z"), item("b", "2026-08-02T10:00:00.000Z")], 1);

    expect(result.pageItems).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor?.id).toBe("a");
  });
});
