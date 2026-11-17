import type { CandidateMatchInput, CandidateMatchResult } from "@/features/candidate-matching/domain/match.types";
import type { Vacancy } from "@/features/vacancies/domain";
import type { ChainExecutionMeta, SearchResultItem } from "@/features/lead-intelligence/providers/manager/types";
import type { CandidateDiscoveryErrorCode } from "@/features/candidate-discovery/domain/candidate-discovery.errors";

export type CandidateDiscoveryUnknownField =
  | "firstName"
  | "lastName"
  | "candidateCurrentRole"
  | "location"
  | "summary"
  | "skills"
  | "experienceYears"
  | "salary"
  | "email"
  | "phone"
  | "availability";

export type ValidatedLinkedInProfileUrl = {
  normalizedUrl: string;
  profileSlug: string;
};

export type ParsedSerpProfile = {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  candidateCurrentRole: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  experienceYears: number | null;
  unknownFields: CandidateDiscoveryUnknownField[];
  serpTitle: string;
  serpSnippet: string;
  serpUrl: string;
};

export type ProfileEvidenceAssessment = {
  eligibleForRanking: boolean;
  hasRoleSignal: boolean;
  hasSecondarySignal: boolean;
  secondarySignals: string[];
  rejectionReason: string | null;
};

export type RankedCandidateProposal = {
  rank: number;
  linkedinUrl: string;
  profile: ParsedSerpProfile;
  matchInput: CandidateMatchInput;
  match: CandidateMatchResult;
  /** Mensleesbare onderbouwing (breakdown + bewijs). */
  matchRationale: string[];
  sourceQuery: string;
  sourceProvider: string | null;
};

export type CandidateDiscoveryQueryPlan = {
  queries: string[];
  vacancyTitle: string;
  locationHint: string | null;
  skillTerms: string[];
};

export type QuerySearchAttempt = {
  query: string;
  success: boolean;
  errorCode?: CandidateDiscoveryErrorCode;
  errorMessage?: string;
  providerId?: string;
  resultCount: number;
  durationMs: number;
  meta?: ChainExecutionMeta;
};

export type AttributedSearchResult = SearchResultItem & {
  sourceQuery: string;
  sourceProvider: string | null;
};

export type CandidateDiscoverySearchOutcome = {
  attempts: QuerySearchAttempt[];
  items: AttributedSearchResult[];
  providerFailures: number;
  allQueriesFailed: boolean;
};

export type CandidateDiscoveryRankOutcome = {
  proposals: RankedCandidateProposal[];
  belowMinScoreCount: number;
  ineligibleCount: number;
  duplicateUrlCount: number;
  minMatchScoreUsed: number;
};

export type CandidateDiscoveryVacancyContext = {
  vacancy: Vacancy;
};