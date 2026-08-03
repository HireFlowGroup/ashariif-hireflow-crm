"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  Filter,
  Loader2,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

import { IntelligenceFeedItemCard } from "@/components/intelligence/intelligence-feed-item-card";
import { useIntelligenceFeed } from "@/components/intelligence/use-intelligence-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FEED_CATEGORIES,
  FEED_CATEGORY_LABELS,
  FEED_SORT_OPTIONS,
  type IntelligenceFeedFilter,
  type IntelligenceFeedSort,
} from "@/features/intelligence-feed/domain/feed.types";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<IntelligenceFeedSort, string> = {
  newest: "Nieuwste eerst",
  oldest: "Oudste eerst",
  priority: "Prioriteit",
  company: "Bedrijf A-Z",
};

export function TodayIntelligenceFeed() {
  const [filter, setFilter] = useState<IntelligenceFeedFilter>("all");
  const [sort, setSort] = useState<IntelligenceFeedSort>("newest");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    items,
    isLoading,
    isLoadingMore,
    isConnected,
    hasMore,
    errorMessage,
    loadMore,
    refresh,
  } = useIntelligenceFeed({ filter, sort });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const todayCount = items.filter((item) => item.isToday).length;

  return (
    <div className="flex w-full flex-col">
      <div className="sticky top-12 z-20 space-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge
              variant={isConnected ? "default" : "outline"}
              className="gap-1 text-[10px] font-normal"
            >
              {isConnected ? (
                <>
                  <Wifi className="size-3" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="size-3" />
                  Offline
                </>
              )}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {todayCount} update{todayCount === 1 ? "" : "s"} vandaag
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void refresh()}>
            <RefreshCw className={cn("size-3.5", isLoading ? "animate-spin" : "")} />
            Vernieuwen
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FEED_CATEGORIES.map((category) => (
            <Button
              key={category}
              type="button"
              size="sm"
              variant={filter === category ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setFilter(category)}
            >
              {category === "all" ? "Alles" : FEED_CATEGORY_LABELS[category]}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Sorteren:</span>
          {FEED_SORT_OPTIONS.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={sort === option ? "secondary" : "ghost"}
              className="h-7 rounded-full px-2.5 text-xs"
              onClick={() => setSort(option)}
            >
              <ArrowDownUp className="mr-1 size-3" />
              {SORT_LABELS[option]}
            </Button>
          ))}
        </div>
      </div>

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive md:mx-6">
          {errorMessage}
        </div>
      ) : null}

      {isLoading && items.length === 0 ? (
        <div className="space-y-3 py-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Radio className="size-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Nog geen intelligence vandaag</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Zodra er nieuwe bedrijven, vacatures, signals of score-wijzigingen zijn, verschijnen
              ze hier automatisch.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1 px-4 pb-8 md:px-6">
          {items.map((item, index) => {
            const showTodayDivider =
              item.isToday &&
              (index === 0 || !items[index - 1]?.isToday);

            const showEarlierDivider =
              !item.isToday &&
              index > 0 &&
              items[index - 1]?.isToday;

            return (
              <div key={item.id}>
                {showTodayDivider ? (
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Vandaag
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                {showEarlierDivider ? (
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Eerder
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                <IntelligenceFeedItemCard item={item} />
              </div>
            );
          })}

          <div ref={sentinelRef} className="flex justify-center py-4">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Meer laden…
              </div>
            ) : hasMore ? (
              <span className="text-xs text-muted-foreground">Scroll voor meer</span>
            ) : (
              <span className="text-xs text-muted-foreground">Je bent helemaal bij</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
