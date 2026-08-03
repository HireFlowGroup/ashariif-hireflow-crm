/** Branded identifier for an external data provider plugin. */
export type FinderProviderId = string & { readonly __brand: "FinderProviderId" };

export function toFinderProviderId(value: string): FinderProviderId {
  return value as FinderProviderId;
}

export type EmployeeCountRange =
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-1000"
  | "1000+";

export type CompanyFinderCriteria = {
  city?: string;
  region?: string;
  sector?: string;
  keywords?: string;
  employeeCountRange?: EmployeeCountRange;
  employeeCountMin?: number;
  employeeCountMax?: number;
  vacancyTitles?: string[];
  hiringSignalTypes?: string[];
  providerIds?: string[];
  searchVacancies?: boolean;
  maxResults?: number;
  excludedNames?: string[];
  excludedSectors?: string[];
  /** Original NL prompt (audit / UI) */
  sourceQuery?: string;
  /** Fast path: Tavily-only discovery, direct save, background enrichment */
  fastMode?: boolean;
};

/** Legacy slim candidate for backward-compatible stream events. */
export type ExternalCompanyCandidate = {
  name: string;
  city: string | null;
  sector: string | null;
  website: string | null;
  employeeCountRange: EmployeeCountRange | null;
  sourceProviderId: FinderProviderId;
  externalId: string;
  sourceUrl: string | null;
  leadScore?: number | null;
  leadPriority?: "A" | "B" | "C" | "D" | null;
  vacancyCount?: number;
};

export type CompanySearchJobStatus =
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

export type CompanySearchJob = {
  id: string;
  organizationId: string;
  userId: string;
  status: CompanySearchJobStatus;
  criteria: CompanyFinderCriteria;
  foundCount: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  providerErrors: Array<{ provider: string; message: string }>;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyFinderProgress = {
  phase: CompanySearchJobStatus;
  message: string;
  providerId?: FinderProviderId;
  activeProvider?: string;
  foundCount: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  providerErrors: Array<{ provider: string; message: string }>;
  progressPercent: number;
};

export type CompanyFinderStreamEventType =
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
