"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

import { PriorityRadarChart } from "@/components/companies/priority-radar-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  INVERTED_PRIORITY_COMPONENTS,
  PRIORITY_COMPONENT_LABELS_NL,
  PRIORITY_COMPONENT_ORDER,
  type PriorityComponentDetail,
  type PriorityProfile,
} from "@/features/priority-engine";
import { priorityColorClass } from "@/features/priority-engine";
import { cn } from "@/lib/utils";

export type CompanyPriorityPanelProps = {
  profile: PriorityProfile | null;
  compositeScore?: number | null;
  priority?: PriorityProfile["priority"] | null;
  summary?: string | null;
  modelVersion?: string | null;
  className?: string;
};

function barColor(value: number, inverted: boolean): string {
  const display = inverted ? 100 - value : value;
  if (display >= 75) return "bg-emerald-500";
  if (display >= 50) return "bg-sky-500";
  if (display >= 30) return "bg-amber-500";
  return "bg-muted-foreground/50";
}

function ComponentRow({ detail }: { detail: PriorityComponentDetail }) {
  const [open, setOpen] = useState(false);
  const inverted = INVERTED_PRIORITY_COMPONENTS.has(detail.key);
  const displayScore = inverted ? 100 - detail.score : detail.score;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{detail.label}</span>
            {inverted ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                lager = beter
              </Badge>
            ) : null}
            {detail.weight > 0 ? (
              <span className="text-[10px] text-muted-foreground">gewicht {detail.weight}%</span>
            ) : null}
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", barColor(detail.score, inverted))}
              style={{ width: `${displayScore}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm tabular-nums text-muted-foreground">{detail.score}/100</span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open ? (
        <div className="space-y-2 border-t px-3 py-2.5">
          {detail.factors.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen factor-uitleg beschikbaar (legacy score).</p>
          ) : (
            detail.factors.map((factor) => (
              <div key={factor.label} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{factor.label}</span>
                <span className="shrink-0 tabular-nums font-medium">+{factor.points}</span>
              </div>
            ))
          )}
          {detail.weight > 0 ? (
            <p className="border-t pt-2 text-[10px] text-muted-foreground">
              Bijdrage aan composite: {detail.weightedContribution} punten (effectief {detail.effectiveScore}/100)
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CompanyPriorityPanel({
  profile,
  compositeScore,
  priority,
  summary,
  modelVersion,
  className,
}: CompanyPriorityPanelProps) {
  const score = profile?.compositeScore ?? compositeScore ?? null;
  const resolvedPriority = profile?.priority ?? priority ?? null;
  const resolvedSummary = profile?.summary ?? summary ?? null;
  const resolvedVersion = profile?.modelVersion ?? modelVersion ?? null;

  const details =
    profile?.details ??
    (profile?.components
      ? PRIORITY_COMPONENT_ORDER.map((key) => ({
          key,
          label: PRIORITY_COMPONENT_LABELS_NL[key],
          score: profile.components[key],
          weight: 0,
          weightedContribution: 0,
          factors: [],
          effectiveScore: profile.components[key],
        }))
      : []);

  if (score === null && details.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Priority Engine</CardTitle>
          <CardDescription>Nog geen priority-profiel berekend voor dit bedrijf.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Priority Engine
              <Info className="size-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>
              Deterministische 8-as priority — geen GPT
              {resolvedVersion ? ` · ${resolvedVersion}` : ""}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums">{score ?? "—"}</div>
            {resolvedPriority ? (
              <div className={cn("text-sm font-semibold", priorityColorClass(resolvedPriority))}>
                Priority {resolvedPriority}
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {details.length > 0 ? (
          <PriorityRadarChart details={details} />
        ) : null}

        {resolvedSummary ? (
          <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            {resolvedSummary}
          </p>
        ) : null}

        {details.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Waarom deze score?
            </p>
            {details.map((detail) => (
              <ComponentRow key={detail.key} detail={detail} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
