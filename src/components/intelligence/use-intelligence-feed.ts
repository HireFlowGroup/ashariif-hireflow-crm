"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  IntelligenceFeedFilter,
  IntelligenceFeedItem,
  IntelligenceFeedPage,
  IntelligenceFeedSort,
} from "@/features/intelligence-feed/domain/feed.types";

type UseIntelligenceFeedOptions = {
  filter: IntelligenceFeedFilter;
  sort: IntelligenceFeedSort;
};

type UseIntelligenceFeedResult = {
  items: IntelligenceFeedItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isConnected: boolean;
  hasMore: boolean;
  errorMessage: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

function mergeUniqueItems(
  existing: IntelligenceFeedItem[],
  incoming: IntelligenceFeedItem[],
  prepend = false,
): IntelligenceFeedItem[] {
  const map = new Map(existing.map((item) => [item.id, item]));

  for (const item of incoming) {
    map.set(item.id, item);
  }

  const merged = [...map.values()];

  if (prepend) {
    return merged.sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
  }

  return merged;
}

export function useIntelligenceFeed({
  filter,
  sort,
}: UseIntelligenceFeedOptions): UseIntelligenceFeedResult {
  const [items, setItems] = useState<IntelligenceFeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      const params = new URLSearchParams({
        filter,
        sort,
        limit: "20",
      });

      if (nextCursor) {
        params.set("cursor", nextCursor);
      }

      const response = await fetch(`/api/intelligence/feed?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Feed laden mislukt");
      }

      const page = (await response.json()) as IntelligenceFeedPage;

      setItems((current) =>
        append ? mergeUniqueItems(current, page.items) : page.items,
      );
      setCursor(page.nextCursor);
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    },
    [filter, sort],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await fetchPage(null, false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Feed laden mislukt");
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !cursorRef.current) return;

    setIsLoadingMore(true);
    setErrorMessage(null);

    try {
      await fetchPage(cursorRef.current, true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Meer laden mislukt");
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, hasMore, isLoadingMore]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    cursorRef.current = null;
    setHasMore(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams({ filter, sort });
    const source = new EventSource(`/api/intelligence/feed/stream?${params.toString()}`);

    source.addEventListener("connected", () => {
      setIsConnected(true);
    });

    source.addEventListener("feed", (event) => {
      try {
        const page = JSON.parse((event as MessageEvent<string>).data) as IntelligenceFeedPage;
        setItems((current) => mergeUniqueItems(current, page.items, true));
        setIsLoading(false);
      } catch {
        setErrorMessage("Live update kon niet worden verwerkt");
      }
    });

    source.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      source.close();
      setIsConnected(false);
    };
  }, [filter, sort]);

  return {
    items,
    isLoading,
    isLoadingMore,
    isConnected,
    hasMore,
    errorMessage,
    loadMore,
    refresh,
  };
}
