"use client";

import { useState } from "react";
import {
  Briefcase,
  Building2,
  ExternalLink,
  Globe,
  Link2,
  MapPin,
  Megaphone,
  Newspaper,
  Radar,
  Sparkles,
  TrendingUp,
  UserPlus,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useCompanyHiringSignalsStream } from "@/components/companies/detail/use-company-hiring-signals-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TIMELINE_FILTER_IDS,
  TIMELINE_FILTERS,
  type HiringSignalTimelineItem,
  type TimelineFilterId,
} from "@/features/hiring-signals-timeline/domain/timeline.types";
import {
  formatConfidence,
  formatHiringSignalProvider,
  formatImpact,
} from "@/lib/hiring-signals/format";
import { cn } from "@/lib/utils";

type CompanyHiringSignalsTimelineProps = {
  companyId: string;
  className?: string;
};

const SIGNAL_ICONS: Record<string, typeof Radar> = {
  vacancy: Briefcase,
  indeed_vacancy: Briefcase,
  careers_page: Briefcase,
  new_recruiter: UserPlus,
  new_hr_manager: UserPlus,
  linkedin_hiring: Link2,
  new_location: MapPin,
  funding: TrendingUp,
  website_change: Globe,
  ats_detected: Globe,
  news: Newspaper,
  google_maps_change: MapPin,
  score_change: Sparkles,
};

function resolveItemIcon(item: HiringSignalTimelineItem) {
  if (item.kind === "score_change") return Sparkles;
  if (item.signalType && SIGNAL_ICONS[item.signalType]) {
    return SIGNAL_ICONS[item.signalType];
  }
  return Radar;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TimelineItemRow({ item }: { item: HiringSignalTimelineItem }) {
  const Icon = resolveItemIcon(item);
  const sourceLabel = item.source ?? formatHiringSignalProvider(item.provider);

  return (
    <article className="group relative flex gap-4 pb-6 last:pb-0">
      <div className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm transition-colors group-hover:border-primary/40">
        <Icon className="size-4 text-primary" />
      </div>

      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <div className="flex flex-wrap items-start gap-2">
          <p className="text-sm font-medium leading-snug">
            <span className="mr-1 text-emerald-600 dark:text-emerald-400">+</span>
            {item.title}
          </p>
          {item.typeLabel ? (
            <Badge variant="secondary" className="text-[10px]">
              {item.typeLabel}
            </Badge>
          ) : null}
        </div>

        {item.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        ) : null}

        <dl className="grid gap-1.5 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-muted/40 px-2 py-1">
            <dt className="text-muted-foreground">Bron</dt>
            <dd className="truncate font-medium">{sourceLabel}</dd>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-1">
            <dt className="text-muted-foreground">Confidence</dt>
            <dd className="font-medium tabular-nums">{formatConfidence(item.confidence)}</dd>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-1">
            <dt className="text-muted-foreground">AI impact</dt>
            <dd className="font-medium tabular-nums">{formatImpact(item.aiImpact)}</dd>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-1">
            <dt className="text-muted-foreground">Recruitment impact</dt>
            <dd className="font-medium tabular-nums">{formatImpact(item.recruitmentImpact)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span>{formatRelative(item.occurredAt)}</span>
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Bekijk bron
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CompanyHiringSignalsTimeline({
  companyId,
  className,
}: CompanyHiringSignalsTimelineProps) {
  const [filter, setFilter] = useState<TimelineFilterId>("all");

  const { timeline, isConnected, isLoading, errorMessage, lastUpdatedAt, refresh } =
    useCompanyHiringSignalsStream({
      companyId,
      filter,
    });

  const totalCount = timeline?.totalCount ?? 0;
  const groups = timeline?.groups ?? [];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="space-y-4 border-b bg-muted/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-5 text-primary" />
              Hiring Signals Timeline
            </CardTitle>
            <CardDescription>
              Chronologisch overzicht van recruitment intelligence per bedrijf
            </CardDescription>
          </div>

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
            {lastUpdatedAt ? (
              <span className="text-[10px] text-muted-foreground">
                Bijgewerkt {formatRelative(lastUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TIMELINE_FILTER_IDS.map((filterId) => (
            <Button
              key={filterId}
              type="button"
              size="sm"
              variant={filter === filterId ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setFilter(filterId)}
            >
              {TIMELINE_FILTERS[filterId].label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {errorMessage ? (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <span>{errorMessage}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
              Opnieuw
            </Button>
          </div>
        ) : null}

        {isLoading && !timeline ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Building2 className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Nog geen hiring signals</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Signals verschijnen hier zodra vacatures, nieuws of recruitment activiteit worden
              gedetecteerd.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.id}>
                <div className="sticky top-0 z-20 -mx-6 mb-4 border-b bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </h3>
                </div>

                <div className="relative pl-1">
                  <div
                    className="absolute bottom-2 left-[18px] top-2 w-px bg-gradient-to-b from-primary/30 via-border to-transparent"
                    aria-hidden
                  />
                  {group.items.map((item) => (
                    <TimelineItemRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!isLoading && totalCount > 0 ? (
          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            {totalCount} signal{totalCount === 1 ? "" : "s"} · filter: {TIMELINE_FILTERS[filter].label}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
