"use client";

import Link from "next/link";
import {
  Briefcase,
  Building2,
  ExternalLink,
  MapPin,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FEED_CATEGORY_LABELS,
  type IntelligenceFeedCategory,
  type IntelligenceFeedItem,
} from "@/features/intelligence-feed/domain/feed.types";

const CATEGORY_CONFIG: Record<
  IntelligenceFeedCategory,
  { icon: typeof Building2; accent: string; dot: string }
> = {
  new_company: {
    icon: Building2,
    accent: "border-l-sky-500",
    dot: "bg-sky-500",
  },
  new_vacancy: {
    icon: Briefcase,
    accent: "border-l-violet-500",
    dot: "bg-violet-500",
  },
  new_recruiter: {
    icon: UserPlus,
    accent: "border-l-emerald-500",
    dot: "bg-emerald-500",
  },
  new_hr_manager: {
    icon: UserRound,
    accent: "border-l-cyan-500",
    dot: "bg-cyan-500",
  },
  new_location: {
    icon: MapPin,
    accent: "border-l-orange-500",
    dot: "bg-orange-500",
  },
  score_change: {
    icon: TrendingUp,
    accent: "border-l-amber-500",
    dot: "bg-amber-500",
  },
  ai_analysis: {
    icon: Sparkles,
    accent: "border-l-purple-500",
    dot: "bg-purple-500",
  },
  opportunity: {
    icon: Target,
    accent: "border-l-rose-500",
    dot: "bg-rose-500",
  },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

type IntelligenceFeedItemCardProps = {
  item: IntelligenceFeedItem;
};

export function IntelligenceFeedItemCard({ item }: IntelligenceFeedItemCardProps) {
  const config = CATEGORY_CONFIG[item.category];
  const Icon = config.icon;
  const ScoreIcon =
    item.scoreDelta !== null && item.scoreDelta < 0 ? TrendingDown : TrendingUp;

  const content = (
    <article
      className={cn(
        "group relative rounded-xl border border-l-4 bg-card p-4 transition-all hover:border-primary/20 hover:bg-muted/20 hover:shadow-sm",
        config.accent,
      )}
    >
      <div className="flex gap-3">
        <div className="relative mt-0.5 shrink-0">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted/60">
            <Icon className="size-4 text-foreground/80" />
          </div>
          {item.isToday ? (
            <span
              className={cn("absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-background", config.dot)}
              aria-hidden
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {FEED_CATEGORY_LABELS[item.category]}
                </Badge>
                {item.isToday ? (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Vandaag
                  </Badge>
                ) : null}
                {item.priority ? (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Priority {item.priority}
                  </Badge>
                ) : null}
              </div>
              <h3 className="text-sm font-semibold leading-snug tracking-tight">{item.title}</h3>
              {item.subtitle ? (
                <p className="text-xs font-medium text-muted-foreground">{item.subtitle}</p>
              ) : null}
            </div>
            <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatRelative(item.occurredAt)}
            </time>
          </div>

          {item.description ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {item.score !== null ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5">
                Score {item.score}
              </span>
            ) : null}
            {item.scoreDelta !== null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5",
                  item.scoreDelta >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400",
                )}
              >
                <ScoreIcon className="size-3" />
                {item.scoreDelta >= 0 ? "+" : ""}
                {item.scoreDelta}
              </span>
            ) : null}
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Bron
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
