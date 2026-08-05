import type { BdOutreachAnalysis } from "@/features/ai-recruiter/domain/types";

export type ProspectDossierCompanyInfo = {
  companyId: string | null;
  name: string;
  logoUrl: string | null;
  website: string | null;
  linkedinUrl: string | null;
  location: string | null;
  sector: string | null;
  employeeLabel: string | null;
  revenueClass: string | null;
};

export type ProspectHiringSnapshot = {
  openVacancies: Array<{
    id: string;
    title: string;
    location: string | null;
    status: string;
    createdAt: string;
  }>;
  departments: string[];
  newVacanciesLast30Days: number;
  hiringTrend: "stijgend" | "stabiel" | "dalend" | "onbekend";
  hiringTrendDetail: string;
};

export type ProspectWhyInteresting = {
  whyInteresting: string;
  whyRecruitmentHard: string;
  whyHireFlowHelps: string;
  expectedOpportunityPercent: number;
};

export type PainScoreDimension = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  detail: string;
};

export type ProspectRecruitmentPainScore = {
  total: number;
  dimensions: PainScoreDimension[];
};

export type ProspectDossierContact = {
  id: string | null;
  name: string;
  jobTitle: string | null;
  email: string | null;
  linkedinUrl: string | null;
  confidence: number | null;
  confidenceLabel: string;
  source: string | null;
  isSelected: boolean;
  isGeneralMailbox: boolean;
};

export type ProspectOutreachHistory = {
  neverContacted: boolean;
  emailsSent: number;
  replies: number;
  meetingScheduled: boolean;
  summaryLines: string[];
  lastContactAt: string | null;
};

export type ProspectDraftMail = {
  messageId: string | null;
  subject: string | null;
  bodyText: string | null;
  status: string | null;
  followUpSubject: string | null;
  followUpBodyText: string | null;
  warnings: string[];
};

export type ProspectDossier = {
  runId: string;
  itemId: string;
  generatedAt: string;
  company: ProspectDossierCompanyInfo;
  hiring: ProspectHiringSnapshot;
  whyInteresting: ProspectWhyInteresting | null;
  painScore: ProspectRecruitmentPainScore;
  contacts: ProspectDossierContact[];
  history: ProspectOutreachHistory;
  notes: string | null;
  draft: ProspectDraftMail;
  bdAnalysis: BdOutreachAnalysis | null;
  itemStage: string;
  totalScore: number | null;
  warnings: string[];
};

export type DraftRewriteStyle = "rewrite" | "shorter" | "personal" | "formal" | "new_version";
