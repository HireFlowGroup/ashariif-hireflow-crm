import type {
  IntelligenceFeedItem,
  IntelligenceFeedSort,
} from "@/features/intelligence-feed/domain/feed.types";

function priorityWeight(priority: string | null): number {
  switch (priority) {
    case "A":
      return 4;
    case "B":
      return 3;
    case "C":
      return 2;
    case "D":
      return 1;
    default:
      return 0;
  }
}

export function sortFeedItems(
  items: IntelligenceFeedItem[],
  sort: IntelligenceFeedSort,
): IntelligenceFeedItem[] {
  const copy = [...items];

  switch (sort) {
    case "oldest":
      return copy.sort(
        (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
      );
    case "priority":
      return copy.sort((left, right) => {
        const priorityDiff = priorityWeight(right.priority) - priorityWeight(left.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return (right.score ?? 0) - (left.score ?? 0);
      });
    case "company":
      return copy.sort((left, right) =>
        (left.companyName ?? left.title).localeCompare(right.companyName ?? right.title, "nl"),
      );
    case "newest":
    default:
      return copy.sort(
        (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
      );
  }
}

export function paginateFeedItems(
  items: IntelligenceFeedItem[],
  limit: number,
): { pageItems: IntelligenceFeedItem[]; hasMore: boolean; nextCursor: { occurredAt: string; id: string } | null } {
  const pageItems = items.slice(0, limit);
  const hasMore = items.length > limit;
  const last = pageItems[pageItems.length - 1];

  return {
    pageItems,
    hasMore,
    nextCursor: last ? { occurredAt: last.occurredAt, id: last.id } : null,
  };
}
