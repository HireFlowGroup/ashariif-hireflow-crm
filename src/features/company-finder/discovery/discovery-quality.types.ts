import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";

/** URL-level category from AI/heuristic classification (step 1). */
export type DiscoveryUrlCategory =
  | "company"
  | "directory"
  | "blog"
  | "news"
  | "government"
  | "listing"
  | "jobboard"
  | "social"
  | "unknown";

/** Stored company type with associated quality score. */
export type DiscoveryCompanyType =
  | "company_website"
  | "holding"
  | "agency"
  | "directory"
  | "news"
  | "government"
  | "spam";

export type DiscoveryRejectionReason =
  | "heuristic_url"
  | "heuristic_title"
  | "heuristic_blocked_host"
  | "ai_url_category"
  | "insufficient_homepage_signals"
  | "ai_not_company"
  | "score_below_threshold"
  | "missing_website";

export type DiscoveryUrlInput = {
  url: string;
  title: string;
  description?: string | null;
};

export type HeuristicClassification = {
  rejected: boolean;
  category?: DiscoveryUrlCategory;
  reason?: DiscoveryRejectionReason;
  detail?: string;
};

export type HomepageSignals = {
  kvk: boolean;
  btw: boolean;
  overOns: boolean;
  contact: boolean;
  vacatures: boolean;
  linkedin: boolean;
  privacy: boolean;
  cookies: boolean;
  phone: boolean;
  address: boolean;
};

export type HomepageSignalResult = {
  signals: HomepageSignals;
  signalCount: number;
  htmlFetched: boolean;
  html?: string;
};

export type UrlClassificationResult = {
  url: string;
  title: string;
  category: DiscoveryUrlCategory;
  source: "heuristic" | "ai";
};

export type CompanyValidationResult = {
  verdict: "company" | "not_company";
  companyType: DiscoveryCompanyType;
  score: number;
  source: "ai" | "heuristic";
};

export type QualifiedDiscoveryCandidate = {
  candidate: ExternalCompanyCandidate;
  companyType: DiscoveryCompanyType;
  companyConfidence: number;
  discoveryReason: string;
  discoveryProvider: string;
  urlCategory: DiscoveryUrlCategory;
  homepageSignalCount: number;
};

export type RejectedDiscoveryUrl = {
  url: string;
  title: string;
  category: DiscoveryUrlCategory;
  reason: DiscoveryRejectionReason;
  detail: string;
  score?: number;
};

export type DiscoveryQualityReport = {
  totalUrls: number;
  rejected: number;
  blogs: number;
  directories: number;
  listings: number;
  news: number;
  government: number;
  social: number;
  jobboards: number;
  unknown: number;
  realCompanies: number;
  saved: number;
  rejectedByHeuristics: number;
  rejectedByAiCategory: number;
  rejectedByHomepageSignals: number;
  rejectedByAiValidation: number;
  rejectedByScore: number;
};

export const DISCOVERY_MIN_SAVE_SCORE = 60;

export const DISCOVERY_TYPE_SCORES: Record<DiscoveryCompanyType, number> = {
  company_website: 100,
  holding: 80,
  agency: 70,
  directory: 30,
  news: 20,
  government: 10,
  spam: 0,
};

export const URL_CATEGORY_TO_COMPANY_TYPE: Partial<
  Record<DiscoveryUrlCategory, DiscoveryCompanyType>
> = {
  directory: "directory",
  listing: "directory",
  blog: "news",
  news: "news",
  government: "government",
  jobboard: "directory",
  social: "spam",
};
