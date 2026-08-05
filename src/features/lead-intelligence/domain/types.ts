import type { LeadScoreComponents } from "@/features/lead-scoring/domain/lead-score.types";

/** Standardized external company candidate from any provider. */
export type ExternalCompanyCandidate = {
  externalId: string;
  name: string;
  normalizedName: string;
  website: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  province: string | null;
  country: string | null;
  sector: string | null;
  employeeCountMin: number | null;
  employeeCountMax: number | null;
  employeeCountLabel: string | null;
  description: string | null;
  careersUrl: string | null;
  vacancyPageUrl: string | null;
  generalEmail: string | null;
  hrEmail: string | null;
  kvkNumber: string | null;
  aiSummary: string | null;
  source: string;
  sourceUrl: string | null;
  vacancyCount: number;
  vacancyTitles: string[];
  hiringSignals: HiringSignal[];
  confidence: number;
  discoveredAt: string;
  lastVerifiedAt: string | null;
};

export type HiringSignal = {
  type: string;
  description: string;
  source: string;
  confidence: number;
};

export type LeadPriority = "A" | "B" | "C" | "D";

export type ScoreBreakdown = LeadScoreComponents & {
  sectorMatch?: number;
  regionMatch?: number;
  companySize?: number;
  activeVacancies?: number;
  relevantVacancies?: number;
  contactCompleteness?: number;
  sourceQuality?: number;
  crmStatus?: number;
  exclusionPenalty?: number;
};

export type LeadScoreResult = {
  score: number;
  priority: LeadPriority;
  scoreReason: string;
  scoreBreakdown: ScoreBreakdown;
  scoredAt: string;
};

export type CompanySearchCriteria = {
  city?: string;
  region?: string;
  sector?: string;
  keywords?: string;
  employeeCountMin?: number;
  employeeCountMax?: number;
  vacancyTitles?: string[];
  hiringSignalTypes?: string[];
  providerIds?: string[];
  searchVacancies?: boolean;
  maxResults?: number;
  excludedNames?: string[];
  excludedSectors?: string[];
  locations?: string[];
  regions?: string[];
  sectors?: string[];
  desiredRoles?: string[];
  /** @deprecated Legacy compat */
  employeeCountRange?: string;
};

export type ProviderContext = {
  organizationId: string;
  userId: string;
  timeoutMs: number;
  maxResults: number;
};

export type JobEventType =
  | "provider_started"
  | "provider_completed"
  | "provider_failed"
  | "company_found"
  | "company_enriched"
  | "duplicate_skipped"
  | "company_saved"
  | "company_updated"
  | "vacancy_found"
  | "scoring_completed"
  | "job_completed";

export type LeadIntelligenceJobStatus =
  | "queued"
  | "pending"
  | "running"
  | "searching"
  | "enriching"
  | "deduplicating"
  | "scoring"
  | "saving"
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled";

export type LeadIntelligenceProgress = {
  phase: LeadIntelligenceJobStatus;
  message: string;
  activeProvider?: string;
  foundCount: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  providerErrors: Array<{ provider: string; message: string }>;
  progressPercent: number;
};

export const SECTOR_OPTIONS = [
  "Accountancy",
  "Administratie en belastingadvies",
  "IT-dienstverlening",
  "Software en SaaS",
  "Techniek",
  "Installatie",
  "Logistiek",
  "Zakelijke dienstverlening",
  "Ingenieurs- en adviesbureaus",
] as const;

export const RELEVANT_VACANCY_KEYWORDS = [
  "administratief medewerker",
  "office manager",
  "managementassistent",
  "hr-medewerker",
  "recruiter",
  "commercieel medewerker binnendienst",
  "accountmanager",
  "customer success manager",
  "planner",
  "projectondersteuner",
  "talent acquisition",
  "hr manager",
] as const;

export const HIRING_PAGE_KEYWORDS = [
  "vacatures",
  "werken bij",
  "join us",
  "careers",
  "jobs",
  "open sollicitaties",
] as const;
