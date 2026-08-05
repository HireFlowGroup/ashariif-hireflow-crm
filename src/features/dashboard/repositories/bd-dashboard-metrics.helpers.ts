import type { BdDailyTrendPoint } from "@/features/dashboard/domain/dashboard.types";

type TrendAccumulator = Omit<BdDailyTrendPoint, "date">;

function computeConversionRate(placements: number, companiesFound: number): number {
  if (companiesFound <= 0) return 0;
  return Math.round((placements / companiesFound) * 1000) / 10;
}

export function sumTrendField(points: BdDailyTrendPoint[], field: keyof TrendAccumulator): number {
  return points.reduce((total, point) => total + point[field], 0);
}

export function periodConversionRate(points: BdDailyTrendPoint[]): number {
  return computeConversionRate(
    sumTrendField(points, "placements"),
    sumTrendField(points, "companiesFound"),
  );
}
