"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { PriorityComponentDetail } from "@/features/priority-engine";
import { INVERTED_PRIORITY_COMPONENTS } from "@/features/priority-engine";
import { cn } from "@/lib/utils";

type PriorityRadarChartProps = {
  details: PriorityComponentDetail[];
  className?: string;
  height?: number;
};

function radarValue(detail: PriorityComponentDetail): number {
  if (INVERTED_PRIORITY_COMPONENTS.has(detail.key)) {
    return 100 - detail.score;
  }
  return detail.score;
}

export function PriorityRadarChart({ details, className, height = 280 }: PriorityRadarChartProps) {
  const data = details.map((detail) => ({
    axis: detail.label.replace(" Availability", "").replace(" Difficulty", ""),
    value: radarValue(detail),
    raw: detail.score,
    inverted: INVERTED_PRIORITY_COMPONENTS.has(detail.key),
  }));

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
            tickCount={5}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="oklch(0.646 0.222 41.116)"
            fill="oklch(0.646 0.222 41.116)"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0]?.payload as (typeof data)[number] | undefined;
              if (!item) return null;

              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{item.axis}</p>
                  <p className="text-muted-foreground">
                    {item.inverted ? "Moeilijkheid" : "Score"}:{" "}
                    <span className="font-medium text-foreground">{item.raw}/100</span>
                  </p>
                  {item.inverted ? (
                    <p className="text-muted-foreground">
                      Weergave: <span className="font-medium text-foreground">{item.value}/100</span> (geïnverteerd)
                    </p>
                  ) : null}
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
