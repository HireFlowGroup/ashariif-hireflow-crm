export const FEED_CATEGORIES = [
  "all",
  "new_company",
  "new_vacancy",
  "new_recruiter",
  "new_hr_manager",
  "new_location",
  "score_change",
  "ai_analysis",
  "opportunity",
] as const;

export type IntelligenceFeedCategory = Exclude<(typeof FEED_CATEGORIES)[number], "all">;

export type IntelligenceFeedFilter = (typeof FEED_CATEGORIES)[number];

export const FEED_SORT_OPTIONS = ["newest", "oldest", "priority", "company"] as const;

export type IntelligenceFeedSort = (typeof FEED_SORT_OPTIONS)[number];

export const FEED_CATEGORY_LABELS: Record<IntelligenceFeedCategory, string> = {
  new_company: "Nieuwe bedrijven",
  new_vacancy: "Nieuwe vacatures",
  new_recruiter: "Nieuwe recruiters",
  new_hr_manager: "Nieuwe HR managers",
  new_location: "Nieuwe vestigingen",
  score_change: "Leadscore wijzigingen",
  ai_analysis: "Nieuwe AI analyses",
  opportunity: "Nieuwe kansen",
};

export type IntelligenceFeedItem = {
  id: string;
  category: IntelligenceFeedCategory;
  title: string;
  subtitle: string | null;
  description: string | null;
  companyId: string | null;
  companyName: string | null;
  occurredAt: string;
  priority: string | null;
  score: number | null;
  scoreDelta: number | null;
  href: string | null;
  sourceUrl: string | null;
  isToday: boolean;
};

export type IntelligenceFeedCursor = {
  occurredAt: string;
  id: string;
};

export type IntelligenceFeedPage = {
  items: IntelligenceFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  generatedAt: string;
  watermark: string;
};

export type IntelligenceFeedQuery = {
  filter: IntelligenceFeedFilter;
  sort: IntelligenceFeedSort;
  limit: number;
  cursor: IntelligenceFeedCursor | null;
  since?: string | null;
};

export function parseFeedFilter(value: string | null | undefined): IntelligenceFeedFilter {
  if (value && FEED_CATEGORIES.includes(value as IntelligenceFeedFilter)) {
    return value as IntelligenceFeedFilter;
  }
  return "all";
}

export function parseFeedSort(value: string | null | undefined): IntelligenceFeedSort {
  if (value && FEED_SORT_OPTIONS.includes(value as IntelligenceFeedSort)) {
    return value as IntelligenceFeedSort;
  }
  return "newest";
}

export function encodeFeedCursor(cursor: IntelligenceFeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeFeedCursor(value: string | null | undefined): IntelligenceFeedCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as IntelligenceFeedCursor;
    if (parsed.occurredAt && parsed.id) return parsed;
  } catch {
    return null;
  }

  return null;
}

export function startOfTodayIso(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
