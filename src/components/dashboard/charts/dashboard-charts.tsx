"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

/** Fallback colors when CSS vars aren't hsl-wrapped */
const FALLBACK_COLORS = [
  "oklch(0.646 0.222 41.116)",
  "oklch(0.6 0.118 184.704)",
  "oklch(0.398 0.07 227.392)",
  "oklch(0.828 0.189 84.429)",
  "oklch(0.769 0.188 70.08)",
];

function chartColor(index: number): string {
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length] ?? FALLBACK_COLORS[0];
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
};

function ChartTooltipContent({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-medium text-popover-foreground">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} className="text-muted-foreground">
          <span className="mr-2 inline-block size-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

type DashboardAreaChartProps = {
  data: Array<{ label: string; value: number }>;
  className?: string;
  height?: number;
};

export function DashboardAreaChart({ data, className, height = 200 }: DashboardAreaChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="signalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor(1)} stopOpacity={0.35} />
              <stop offset="95%" stopColor={chartColor(1)} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="value"
            name="Signals"
            stroke={chartColor(1)}
            fill="url(#signalGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type DashboardMultiSeriesAreaChartProps = {
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; name: string }>;
  className?: string;
  height?: number;
};

export function DashboardMultiSeriesAreaChart({
  data,
  series,
  className,
  height = 220,
}: DashboardMultiSeriesAreaChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {series.map((item, index) => (
              <linearGradient key={item.key} id={`bdGradient-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor(index)} stopOpacity={0.25} />
                <stop offset="95%" stopColor={chartColor(index)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
          {series.map((item, index) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.name}
              stroke={chartColor(index)}
              fill={`url(#bdGradient-${item.key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type DashboardBarChartProps = {
  data: Array<{ label: string; value: number }>;
  className?: string;
  height?: number;
  layout?: "horizontal" | "vertical";
};

export function DashboardBarChart({
  data,
  className,
  height = 220,
  layout = "vertical",
}: DashboardBarChartProps) {
  const isHorizontal = layout === "horizontal";

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isHorizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 8, left: isHorizontal ? 8 : -16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={!isHorizontal} vertical={isHorizontal} />
          {isHorizontal ? (
            <>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            </>
          )}
          <Tooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" name="Aantal" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={chartColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type DashboardPieChartProps = {
  data: Array<{ label: string; value: number }>;
  className?: string;
  height?: number;
};

export function DashboardPieChart({ data, className, height = 220 }: DashboardPieChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={chartColor(index)} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltipContent />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export { chartColor, CHART_COLORS };
