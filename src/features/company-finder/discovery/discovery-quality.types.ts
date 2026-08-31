import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";

/** URL-level category from AI/heuristic classification. */
export type DiscoveryUrlCategory =
  | "company"
  | "directory"
  | "blog"
  | "news"
  | "government"
  | "listing"
  | "jobboard"
  | "social"
  | "forum"
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

/**
 * Exact rejection reasons logged for every afwijzing.
 * Includes legacy ashariif reasons + Make-HireFlow consolidation reasons.
 */
export type DiscoveryRejectionReason =
  | "blog"
  | "directory"
  | "government"
  | "duplicate"
  | "low_confidence"
  | "missing_company_signals"
  | "news"
  | "jobboard"
  | "forum"
  | "wikipedia"
  | "missing_website"
  // Legacy (still accepted for older call sites / tests)
  | "heuristic_url"
  | "heuristic_title"
  | "heuristic_blocked_host"
  | "ai_url_category"
  | "insufficient_homepage_signals"
  | "ai_not_company"
  | "score_below_threshold";

export type DiscoverySaveStatus = "company" | "review";

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
  /** Only high-confidence heuristic blocks may reject a URL. */
  highConfidence?: boolean;
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
  email: boolean;
  address: boolean;
};

export type HomepageSignalResult = {
  signals: HomepageSignals;
  signalCount: number;
  companySignalCount: number;
  hasCompanyAcceptanceSignal: boolean;
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
  confidence: number;
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
  /** company = accepted; review = mid-confidence AI band (50–70). */
  saveStatus: DiscoverySaveStatus;
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
  forums: number;
  unknown: number;
  realCompanies: number;
  review: number;
  saved: number;
  rejectedByHeuristics: number;
  rejectedByAiCategory: number;
  rejectedByHomepageSignals: number;
  rejectedByAiValidation: number;
  rejectedByScore: number;
  rejectedByDuplicate: number;
  rejectedByLowConfidence: number;
};

/** Accept as company when AI confidence is strictly above this. */
export const DISCOVERY_ACCEPT_CONFIDENCE = 70;

/** Mid band → save with status Review (inclusive). */
export const DISCOVERY_REVIEW_CONFIDENCE_MIN = 50;

/** @deprecated Prefer DISCOVERY_ACCEPT_CONFIDENCE / review band. Kept for legacy tests. */
export const DISCOVERY_MIN_SAVE_SCORE = 50;

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
  forum: "spam",
  social: "spam",
};

/** Map internal category → logged rejection reason. */
export function categoryToRejectionReason(
  category: DiscoveryUrlCategory,
): DiscoveryRejectionReason {
  switch (category) {
    case "blog":
      return "blog";
    case "directory":
    case "listing":
      return "directory";
    case "government":
      return "government";
    case "news":
      return "news";
    case "jobboard":
      return "jobboard";
    case "forum":
      return "forum";
    default:
      return "low_confidence";
  }
}
