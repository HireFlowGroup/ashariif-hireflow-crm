"use client";

import { PRIORITY_COMPONENT_LABELS_NL } from "@/features/priority-engine/config/priority-engine.config";
import type { LeadPriority, LeadScoreComponents } from "@/features/lead-scoring/domain/lead-score.types";
import { priorityColorClass } from "@/features/lead-scoring/domain/lead-score.types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CompanyScorecardProps = {
  score: number | null;
  priority: LeadPriority | null;
  scoreReason: string | null;
  explanation: string | null;
  components: LeadScoreComponents | null;
  modelVersion?: string | null;
  className?: string;
};

function componentEntries(components: LeadScoreComponents | null) {
  if (!components) return [];

  return (Object.entries(components) as Array<[keyof LeadScoreComponents, number]>).map(
    ([key, value]) => ({
      key,
      label: PRIORITY_COMPONENT_LABELS_NL[key],
      value,
    }),
  );
}

function barColor(value: number): string {
  if (value >= 75) return "bg-emerald-500";
  if (value >= 50) return "bg-sky-500";
  if (value >= 30) return "bg-amber-500";
  return "bg-muted-foreground/50";
}

export function CompanyScorecard({
  score,
  priority,
  scoreReason,
  explanation,
  components,
  modelVersion,
  className,
}: CompanyScorecardProps) {
  const entries = componentEntries(components);

  if (score === null && !components) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Lead Scorecard</CardTitle>
          <CardDescription>Nog geen score berekend voor dit bedrijf.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Lead Scorecard</CardTitle>
            <CardDescription>
              Deterministische multi-component score
              {modelVersion ? ` · ${modelVersion}` : ""}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums">{score ?? "—"}</div>
            {priority ? (
              <div className={cn("text-sm font-semibold", priorityColorClass(priority))}>
                Priority {priority}
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {entries.length > 0 ? (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{entry.label}</span>
                  <span className="tabular-nums text-muted-foreground">{entry.value}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", barColor(entry.value))}
                    style={{ width: `${entry.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {scoreReason ? (
          <p className="text-sm text-muted-foreground">{scoreReason}</p>
        ) : null}

        {explanation ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AI uitleg
            </p>
            <p className="mt-1 text-sm leading-relaxed">{explanation}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
