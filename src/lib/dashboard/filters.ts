import type { DashboardFilters, DashboardPeriod } from "@/features/dashboard/domain/dashboard.types";
import type { CompanyScorePriority } from "@/types/hiring-intelligence";

export function parseDashboardFilters(searchParams: {
  period?: string;
  priority?: string;
  sector?: string;
}): DashboardFilters {
  const period: DashboardPeriod =
    searchParams.period === "today" || searchParams.period === "30d"
      ? searchParams.period
      : "7d";

  const priorityValues: Array<CompanyScorePriority | "all"> = ["A", "B", "C", "D", "all"];
  const priority = priorityValues.includes(searchParams.priority as CompanyScorePriority | "all")
    ? (searchParams.priority as CompanyScorePriority | "all")
    : "all";

  return {
    period,
    priority: priority === "all" ? undefined : priority,
    sector: searchParams.sector?.trim() || undefined,
  };
}

export function buildDashboardFilterUrl(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  params.set("period", filters.period);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.sector) params.set("sector", filters.sector);
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}
