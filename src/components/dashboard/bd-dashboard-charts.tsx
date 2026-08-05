"use client";

import { useMemo, useState } from "react";

import {
  DashboardAreaChart,
  DashboardBarChart,
  DashboardMultiSeriesAreaChart,
} from "@/components/dashboard/charts/dashboard-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BdChartPeriod, BdDailyTrendPoint } from "@/features/dashboard/domain/dashboard.types";
import { periodConversionRate, sumTrendField } from "@/features/dashboard/repositories/bd-dashboard-metrics.loader";

type BdDashboardChartsProps = {
  trends: Record<BdChartPeriod, BdDailyTrendPoint[]>;
};

const PERIOD_OPTIONS: Array<{ id: BdChartPeriod; label: string }> = [
  { id: "7d", label: "7 dagen" },
  { id: "30d", label: "30 dagen" },
  { id: "90d", label: "90 dagen" },
];

function formatDayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

export function BdDashboardCharts({ trends }: BdDashboardChartsProps) {
  const [period, setPeriod] = useState<BdChartPeriod>("7d");
  const points = trends[period];

  const funnelSeries = useMemo(
    () =>
      points.map((point) => ({
        label: formatDayLabel(point.date),
        "Bedrijven gevonden": point.companiesFound,
        "Verzonden mails": point.sentEmails,
        "Positieve reacties": point.positiveReplies,
        Plaatsingen: point.placements,
      })),
    [points],
  );

  const outreachSeries = useMemo(
    () =>
      points.map((point) => ({
        label: formatDayLabel(point.date),
        Conceptmails: point.draftEmails,
        "Verzonden mails": point.sentEmails,
        "Reacties ontvangen": point.openReplies,
      })),
    [points],
  );

  const pipelineSeries = useMemo(
    () =>
      points.map((point) => ({
        label: formatDayLabel(point.date),
        Intakes: point.intakes,
        Vacatures: point.newVacancies,
        Voorgesteld: point.candidatesProposed,
        Plaatsingen: point.placements,
      })),
    [points],
  );

  const summaryBar = useMemo(
    () => [
      { label: "Bedrijven", value: sumTrendField(points, "companiesFound") },
      { label: "Geanalyseerd", value: sumTrendField(points, "analyzed") },
      { label: "Contacten", value: sumTrendField(points, "newContacts") },
      { label: "Conceptmails", value: sumTrendField(points, "draftEmails") },
      { label: "Verzonden", value: sumTrendField(points, "sentEmails") },
      { label: "Positief", value: sumTrendField(points, "positiveReplies") },
      { label: "Intakes", value: sumTrendField(points, "intakes") },
      { label: "Plaatsingen", value: sumTrendField(points, "placements") },
    ],
    [points],
  );

  const periodConversion = periodConversionRate(points);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Trends</h2>
          <p className="text-xs text-muted-foreground">
            Periode-conversie: {periodConversion.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-muted/30 p-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPeriod(option.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                period === option.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">BD-funnel</CardTitle>
            <CardDescription>Prospect → mail → reactie → plaatsing</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardMultiSeriesAreaChart
              data={funnelSeries}
              series={[
                { key: "Bedrijven gevonden", name: "Bedrijven gevonden" },
                { key: "Verzonden mails", name: "Verzonden mails" },
                { key: "Positieve reacties", name: "Positieve reacties" },
                { key: "Plaatsingen", name: "Plaatsingen" },
              ]}
              height={240}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outreach & reacties</CardTitle>
            <CardDescription>Conceptmails, verzending en inbound</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardMultiSeriesAreaChart
              data={outreachSeries}
              series={[
                { key: "Conceptmails", name: "Conceptmails" },
                { key: "Verzonden mails", name: "Verzonden mails" },
                { key: "Reacties ontvangen", name: "Reacties ontvangen" },
              ]}
              height={240}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline downstream</CardTitle>
            <CardDescription>Intake → vacature → voorstel → plaatsing</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardMultiSeriesAreaChart
              data={pipelineSeries}
              series={[
                { key: "Intakes", name: "Intakes" },
                { key: "Vacatures", name: "Vacatures" },
                { key: "Voorgesteld", name: "Voorgesteld" },
                { key: "Plaatsingen", name: "Plaatsingen" },
              ]}
              height={240}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totaal per metric</CardTitle>
            <CardDescription>Som over geselecteerde periode</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardBarChart data={summaryBar} layout="horizontal" height={280} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Bedrijven gevonden</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardAreaChart
              data={points.map((point) => ({
                label: formatDayLabel(point.date),
                value: point.companiesFound,
              }))}
              height={140}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Verzonden mails</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardAreaChart
              data={points.map((point) => ({
                label: formatDayLabel(point.date),
                value: point.sentEmails,
              }))}
              height={140}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Positieve reacties</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardAreaChart
              data={points.map((point) => ({
                label: formatDayLabel(point.date),
                value: point.positiveReplies,
              }))}
              height={140}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Plaatsingen</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardAreaChart
              data={points.map((point) => ({
                label: formatDayLabel(point.date),
                value: point.placements,
              }))}
              height={140}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
