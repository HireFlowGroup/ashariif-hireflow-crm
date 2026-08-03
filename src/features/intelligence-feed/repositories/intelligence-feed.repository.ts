import type {
  IntelligenceFeedCategory,
  IntelligenceFeedCursor,
  IntelligenceFeedItem,
} from "@/features/intelligence-feed/domain/feed.types";

export type FetchFeedBatchOptions = {
  organizationId: string;
  before: string | null;
  since: string | null;
  categories: IntelligenceFeedCategory[] | "all";
  fetchLimit: number;
};

export interface IntelligenceFeedRepository {
  fetchBatch(options: FetchFeedBatchOptions): Promise<IntelligenceFeedItem[]>;

  getWatermark(organizationId: string): Promise<string>;
}

export class IntelligenceFeedRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntelligenceFeedRepositoryError";
  }
}

export function shouldFetchCategory(
  categories: IntelligenceFeedCategory[] | "all",
  category: IntelligenceFeedCategory,
): boolean {
  return categories === "all" || categories.includes(category);
}

export function isBeforeCursor(item: IntelligenceFeedItem, cursor: IntelligenceFeedCursor | null): boolean {
  if (!cursor) return true;

  const itemTime = new Date(item.occurredAt).getTime();
  const cursorTime = new Date(cursor.occurredAt).getTime();

  if (itemTime < cursorTime) return true;
  if (itemTime > cursorTime) return false;

  return item.id < cursor.id;
}
