import {
  encodeFeedCursor,
  type IntelligenceFeedCategory,
  type IntelligenceFeedFilter,
  type IntelligenceFeedPage,
  type IntelligenceFeedQuery,
} from "@/features/intelligence-feed/domain/feed.types";
import {
  isBeforeCursor,
  type IntelligenceFeedRepository,
} from "@/features/intelligence-feed/repositories/intelligence-feed.repository";
import {
  paginateFeedItems,
  sortFeedItems,
} from "@/features/intelligence-feed/services/merge-feed-items";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const FETCH_MULTIPLIER = 4;

function defaultFeedSince(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

export class IntelligenceFeedService {
  constructor(private readonly repository: IntelligenceFeedRepository) {}

  async getPage(
    organizationId: string,
    query: Partial<IntelligenceFeedQuery> & {
      filter?: IntelligenceFeedFilter;
      sort?: IntelligenceFeedQuery["sort"];
      cursor?: IntelligenceFeedQuery["cursor"];
    },
  ): Promise<IntelligenceFeedPage> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const filter = query.filter ?? "all";
    const sort = query.sort ?? "newest";
    const cursor = query.cursor ?? null;
    const since = query.since ?? defaultFeedSince();

    const categories: IntelligenceFeedCategory[] | "all" =
      filter === "all" ? "all" : [filter];

    const batch = await this.repository.fetchBatch({
      organizationId,
      before: cursor?.occurredAt ?? null,
      since,
      categories,
      fetchLimit: limit * FETCH_MULTIPLIER,
    });

    const filtered = batch.filter((item) => isBeforeCursor(item, cursor));
    const sorted = sortFeedItems(filtered, sort);
    const { pageItems, hasMore, nextCursor } = paginateFeedItems(sorted, limit);
    const watermark = await this.repository.getWatermark(organizationId);

    return {
      items: pageItems,
      hasMore,
      nextCursor: nextCursor ? encodeFeedCursor(nextCursor) : null,
      generatedAt: new Date().toISOString(),
      watermark,
    };
  }

  async getWatermark(organizationId: string): Promise<string> {
    return this.repository.getWatermark(organizationId);
  }
}
