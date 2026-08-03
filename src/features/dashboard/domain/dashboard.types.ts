import type { CompanyScorePriority } from "@/types/hiring-intelligence";

export type DashboardPeriod = "today" | "7d" | "30d";

export type DashboardFilters = {
  period: DashboardPeriod;
  priority?: CompanyScorePriority | "all";
  sector?: string;
};

export type DashboardKpis = {
  newHiringSignals: number;
  newVacancies: number;
  newCompanies: number;
  newRecruiters: number;
  todaysIntelligence: number;
  unreadNotifications: number;
  warmLeadsCount: number;
};

export type DashboardWarmLead = {
  id: string;
  name: string;
  city: string | null;
  sector: string | null;
  score: number | null;
  priority: CompanyScorePriority | null;
  hiringIntensity: number;
  signalCount: number;
  vacancyCount: number;
  lastSignalAt: string | null;
  outreachStatus: string | null;
};

export type DashboardSignalItem = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  signalType: string;
  title: string | null;
  source: string | null;
  observedAt: string;
  importance: number;
};

export type DashboardVacancyItem = {
  id: string;
  title: string;
  companyId: string;
  companyName: string | null;
  status: string;
  city: string | null;
  createdAt: string;
};

export type DashboardRecruiterSignal = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  title: string | null;
  description: string | null;
  observedAt: string;
  sourceUrl: string | null;
};

export type DashboardPrioritySlice = {
  priority: CompanyScorePriority | "unscored";
  count: number;
  label: string;
};

export type DashboardPipelineStage = {
  stage: string;
  count: number;
  label: string;
};

export type DashboardOutreachSlice = {
  status: string;
  count: number;
  label: string;
};

export type DashboardAiRecommendation = {
  id: string;
  companyId: string;
  companyName: string;
  priority: CompanyScorePriority | null;
  score: number | null;
  recommendation: string;
  action: string;
};

export type DashboardTodaysIntelligence = {
  scanStatus: string | null;
  signalsCreated: number;
  signalsUpdated: number;
  notificationsCreated: number;
  companiesProcessed: number;
  companiesTotal: number;
  lastScanAt: string | null;
  recentNotifications: Array<{
    id: string;
    title: string;
    message: string;
    notificationType: string;
    createdAt: string;
    companyId: string;
  }>;
};

export type DashboardSignalTrendPoint = {
  date: string;
  count: number;
};

export type DashboardSnapshot = {
  filters: DashboardFilters;
  kpis: DashboardKpis;
  warmLeads: DashboardWarmLead[];
  recentSignals: DashboardSignalItem[];
  recentVacancies: DashboardVacancyItem[];
  recruiterSignals: DashboardRecruiterSignal[];
  priorityDistribution: DashboardPrioritySlice[];
  pipelineStages: DashboardPipelineStage[];
  outreachDistribution: DashboardOutreachSlice[];
  aiRecommendations: DashboardAiRecommendation[];
  todaysIntelligence: DashboardTodaysIntelligence;
  signalTrend: DashboardSignalTrendPoint[];
  generatedAt: string;
};

export function periodToStartDate(period: DashboardPeriod): string {
  const now = new Date();

  if (period === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  const days = period === "7d" ? 7 : 30;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

export function todayStartIso(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}
