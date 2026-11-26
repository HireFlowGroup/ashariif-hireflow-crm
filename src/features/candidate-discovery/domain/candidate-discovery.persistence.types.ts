import type { CandidateMatchBreakdown } from "@/features/candidate-matching/domain/match.types";
import type { CandidateDiscoveryErrorCode } from "@/features/candidate-discovery/domain/candidate-discovery.errors";
import type {
  CandidateDiscoveryQueryPlan,
  QuerySearchAttempt,
  RankedCandidateProposal,
} from "@/features/candidate-discovery/domain/candidate-discovery.types";

export type CandidateDiscoveryRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "partial";

export type CandidateDiscoveryProposalStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "saved";

export type CandidateDiscoveryRun = {
  id: string;
  organizationId: string;
  vacancyId: string;
  createdBy: string;
  status: CandidateDiscoveryRunStatus;
  queries: string[];
  queryPlan: CandidateDiscoveryQueryPlan;
  searchAttempts: QuerySearchAttempt[];
  providerMeta: Record<string, unknown>;
  proposalCount: number;
  belowThresholdCount: number;
  ineligibleCount: number;
  duplicateUrlCount: number;
  providerFailures: number;
  minMatchScoreUsed: number;
  errorCode: CandidateDiscoveryErrorCode | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  retentionExpiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CandidateDiscoveryProposal = {
  id: string;
  organizationId: string;
  vacancyId: string;
  runId: string;
  rank: number;
  linkedinUrl: string;
  linkedinProfileSlug: string | null;
  firstName: string;
  lastName: string;
  candidateCurrentRole: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  experienceYears: number | null;
  unknownFields: string[];
  sourceProvider: string | null;
  sourceQuery: string | null;
  serpTitle: string | null;
  serpSnippet: string | null;
  matchScore: number;
  matchBreakdown: CandidateMatchBreakdown;
  matchStrongPoints: string[];
  matchRisks: string[];
  matchMissingInfo: string[];
  matchRationale: string[];
  approvalStatus: CandidateDiscoveryProposalStatus;
  savedCandidateId: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCandidateDiscoveryRunInput = {
  organizationId: string;
  vacancyId: string;
  createdBy: string;
  status?: CandidateDiscoveryRunStatus;
  queries: string[];
  queryPlan: CandidateDiscoveryQueryPlan;
  minMatchScoreUsed: number;
};

export type UpdateCandidateDiscoveryRunInput = {
  status?: CandidateDiscoveryRunStatus;
  searchAttempts?: QuerySearchAttempt[];
  providerMeta?: Record<string, unknown>;
  proposalCount?: number;
  belowThresholdCount?: number;
  ineligibleCount?: number;
  duplicateUrlCount?: number;
  providerFailures?: number;
  errorCode?: CandidateDiscoveryErrorCode | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type InsertProposalsFromRankInput = {
  organizationId: string;
  vacancyId: string;
  runId: string;
  ranked: RankedCandidateProposal[];
};

export type InsertProposalsResult = {
  inserted: CandidateDiscoveryProposal[];
  skippedDuplicates: number;
};

export type UpdateProposalStatusInput = {
  proposalId: string;
  organizationId: string;
  approvalStatus: CandidateDiscoveryProposalStatus;
  reviewedBy: string;
  savedCandidateId?: string | null;
};