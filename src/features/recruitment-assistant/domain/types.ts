export type RecruitmentInsightPeriod = "7d" | "30d" | "90d";

export type RecruitmentCompanyInsight = {
  rank: number;
  companyId: string;
  name: string;
  city: string | null;
  sector: string | null;
  score: number | null;
  priority: string | null;
  hiringIntensity: number;
  signalCount: number;
  vacancyCount: number;
  lastSignalAt: string | null;
  outreachStatus: string | null;
  reason: string;
  evidence: string[];
};

export type RecruitmentVacancyInsight = {
  rank: number;
  companyId: string;
  companyName: string;
  vacancyCount: number;
  latestVacancyTitle: string | null;
  latestVacancyAt: string | null;
  city: string | null;
  sector: string | null;
};

export type RecruitmentRecruiterInsight = {
  rank: number;
  companyId: string;
  companyName: string;
  signalType: string;
  title: string | null;
  observedAt: string;
  sourceUrl: string | null;
};

export type RecruitmentCallLead = {
  rank: number;
  companyId: string;
  name: string;
  score: number | null;
  priority: string | null;
  city: string | null;
  sector: string | null;
  outreachStatus: string | null;
  hiringIntensity: number;
  lastSignalAt: string | null;
  callReason: string;
  aiSummary: string | null;
};

export type SimilarCompanyInsight = {
  rank: number;
  companyId: string;
  name: string;
  city: string | null;
  sector: string | null;
  score: number | null;
  hiringIntensity: number;
  similarityScore: number;
  similarityReasons: string[];
};

export type WarmingLeadInsight = {
  rank: number;
  companyId: string;
  name: string;
  city: string | null;
  sector: string | null;
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  priority: string | null;
  hiringIntensity: number;
  lastSignalAt: string | null;
  warmedAt: string;
  evidence: string[];
};

export type QuietClientInsight = {
  rank: number;
  companyId: string;
  name: string;
  city: string | null;
  sector: string | null;
  score: number | null;
  priority: string | null;
  lastSignalAt: string | null;
  daysSinceSignal: number | null;
  outreachStatus: string | null;
  signalCount: number;
  quietReason: string;
  evidence: string[];
};

export type AtsCompanyInsight = {
  rank: number;
  companyId: string;
  name: string;
  city: string | null;
  sector: string | null;
  atsName: string;
  detectedAt: string | null;
  sourceUrl: string | null;
  evidence: string[];
};

export type VacancyRoleInsight = {
  rank: number;
  companyId: string;
  companyName: string;
  vacancyCount: number;
  matchingTitles: string[];
  latestVacancyAt: string | null;
  city: string | null;
  sector: string | null;
  evidence: string[];
};

export type RecruitmentInsightResult<T> = {
  query: string;
  period: RecruitmentInsightPeriod | null;
  limit: number;
  total: number;
  generatedAt: string;
  items: T[];
  dataSource: string;
};
