/**
 * Canonical Hiring Signal types for the Recruitment Intelligence Platform.
 */

export const HIRING_SIGNAL_TYPES = {
  vacancy: {
    slug: "vacancy",
    label: "Vacature",
    defaultImportance: 85,
    defaultConfidence: 0.75,
  },
  new_location: {
    slug: "new_location",
    label: "Nieuwe vestiging",
    defaultImportance: 70,
    defaultConfidence: 0.65,
  },
  new_recruiter: {
    slug: "new_recruiter",
    label: "Nieuwe recruiter",
    defaultImportance: 80,
    defaultConfidence: 0.7,
  },
  new_hr_manager: {
    slug: "new_hr_manager",
    label: "Nieuwe HR manager",
    defaultImportance: 85,
    defaultConfidence: 0.72,
  },
  funding: {
    slug: "funding",
    label: "Funding",
    defaultImportance: 60,
    defaultConfidence: 0.6,
  },
  website_change: {
    slug: "website_change",
    label: "Website wijziging",
    defaultImportance: 40,
    defaultConfidence: 0.55,
  },
  news: {
    slug: "news",
    label: "Nieuws",
    defaultImportance: 50,
    defaultConfidence: 0.55,
  },
  linkedin_hiring: {
    slug: "linkedin_hiring",
    label: "LinkedIn hiring",
    defaultImportance: 75,
    defaultConfidence: 0.7,
  },
  ats_detected: {
    slug: "ats_detected",
    label: "ATS gevonden",
    defaultImportance: 90,
    defaultConfidence: 0.85,
  },
  careers_page: {
    slug: "careers_page",
    label: "Werken-bij pagina",
    defaultImportance: 80,
    defaultConfidence: 0.8,
  },
  indeed_vacancy: {
    slug: "indeed_vacancy",
    label: "Indeed vacature",
    defaultImportance: 85,
    defaultConfidence: 0.78,
  },
  google_maps_change: {
    slug: "google_maps_change",
    label: "Google Maps wijziging",
    defaultImportance: 55,
    defaultConfidence: 0.65,
  },
} as const;

export type HiringSignalType = keyof typeof HIRING_SIGNAL_TYPES;

export type HiringSignalProviderId =
  | "brave_search"
  | "google_maps"
  | "firecrawl"
  | "indeed"
  | "werkenbij"
  | "linkedin"
  | "nationale_vacaturebank";

export type CompanyHint = {
  name: string;
  normalizedName?: string;
  website?: string | null;
  domain?: string | null;
  linkedinUrl?: string | null;
  city?: string | null;
  region?: string | null;
  sector?: string | null;
};

/** Signal emitted by a provider before persistence. */
export type IncomingHiringSignal = {
  type: HiringSignalType;
  title: string;
  description: string;
  url: string | null;
  source: string;
  provider: HiringSignalProviderId;
  confidence: number;
  importance: number;
  aiRelevance: number;
  observedAt?: string;
  companyId?: string | null;
  companyHint?: CompanyHint | null;
  externalId?: string | null;
  payload?: Record<string, unknown>;
  extractedFields?: Record<string, unknown>;
};

export type IngestHiringSignalResult = {
  signalId: string;
  created: boolean;
  updated: boolean;
  fingerprint: string;
};

export type CollectSignalsContext = {
  organizationId: string;
  userId: string;
  jobId?: string | null;
  timeoutMs: number;
  maxResults: number;
  maxResultsPerProvider?: number;
  providerConcurrency?: number;
  ingestConcurrency?: number;
};

export type CollectSignalsCriteria = {
  /** Target company for nightly refresh scans */
  companyName?: string;
  website?: string | null;
  domain?: string | null;
  linkedinUrl?: string | null;
  city?: string;
  region?: string;
  sector?: string;
  keywords?: string;
  vacancyTitles?: string[];
  hiringSignalTypes?: string[];
  providerIds?: string[];
  maxResults?: number;
};

export function getSignalTypeLabel(type: HiringSignalType): string {
  return HIRING_SIGNAL_TYPES[type].label;
}

export function getDefaultImportance(type: HiringSignalType): number {
  return HIRING_SIGNAL_TYPES[type].defaultImportance;
}

export function getDefaultConfidence(type: HiringSignalType): number {
  return HIRING_SIGNAL_TYPES[type].defaultConfidence;
}
