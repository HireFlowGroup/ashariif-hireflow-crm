"use client";

import {
  DashboardAreaChart,
  DashboardBarChart,
  DashboardPieChart,
} from "@/components/dashboard/charts/dashboard-charts";
import type { DashboardSnapshot } from "@/features/dashboard/domain/dashboard.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsDashboardProps = {
  snapshot: DashboardSnapshot;
};

export function AnalyticsDashboard({ snapshot }: AnalyticsDashboardProps) {
  const priorityData = snapshot.priorityDistribution.map((slice) => ({
    label: slice.label,
    value: slice.count,
  }));

  const signalTrend = snapshot.signalTrend.map((point) => ({
    label: new Date(point.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
    value: point.count,
  }));

  const outreachData = snapshot.outreachDistribution.map((slice) => ({
    label: slice.label,
    value: slice.count,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Signal trend</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardAreaChart data={signalTrend} height={220} />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Priority verdeling</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardPieChart data={priorityData} height={220} />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Outreach status</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardBarChart data={outreachData} height={240} />
        </CardContent>
      </Card>
    </div>
  );
}
