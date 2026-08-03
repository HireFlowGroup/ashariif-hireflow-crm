export type {
  DashboardAiRecommendation,
  DashboardFilters,
  DashboardKpis,
  DashboardPeriod,
  DashboardPipelineStage,
  DashboardPrioritySlice,
  DashboardRecruiterSignal,
  DashboardSignalItem,
  DashboardSignalTrendPoint,
  DashboardSnapshot,
  DashboardTodaysIntelligence,
  DashboardVacancyItem,
  DashboardWarmLead,
} from "@/features/dashboard/domain/dashboard.types";
export { periodToStartDate, todayStartIso } from "@/features/dashboard/domain/dashboard.types";
export { createDashboardService } from "@/features/dashboard/create-dashboard-service";
export { DashboardService } from "@/features/dashboard/services/dashboard.service";
