import type { CandidateMatchBreakdown } from "@/features/candidate-matching/domain/match.types";
import type {
  CandidateDiscoveryProposal,
  CandidateDiscoveryProposalStatus,
  CandidateDiscoveryRun,
  CandidateDiscoveryRunStatus,
} from "@/features/candidate-discovery/domain/candidate-discovery.persistence.types";
import type { CandidateDiscoveryErrorCode } from "@/features/candidate-discovery/domain/candidate-discovery.errors";
import type {
  CandidateDiscoveryQueryPlan,
  QuerySearchAttempt,
  RankedCandidateProposal,
} from "@/features/candidate-discovery/domain/candidate-discovery.types";
import { normalizeLinkedInProfileUrl } from "@/features/candidate-discovery/services/linkedin-profile-url.validator";

export type CandidateDiscoveryRunRow = {
  id: string;
  organization_id: string;
  vacancy_id: string;
  created_by: string;
  status: string;
  queries: unknown;
  query_plan: unknown;
  search_attempts: unknown;
  provider_meta: unknown;
  proposal_count: number;
  below_threshold_count: number;
  ineligible_count: number;
  duplicate_url_count: number;
  provider_failures: number;
  min_match_score_used: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  retention_expires_at: string;
  created_at: string;
  updated_at: string;
};

export type CandidateDiscoveryProposalRow = {
  id: string;
  organization_id: string;
  vacancy_id: string;
  run_id: string;
  rank: number;
  linkedin_url: string;
  linkedin_profile_slug: string | null;
  first_name: string;
  last_name: string;
  candidate_current_role: string | null;
  location: string | null;
  summary: string | null;
  skills: unknown;
  experience_years: number | null;
  unknown_fields: unknown;
  source_provider: string | null;
  source_query: string | null;
  serp_title: string | null;
  serp_snippet: string | null;
  match_score: number;
  match_breakdown: unknown;
  match_strong_points: unknown;
  match_risks: unknown;
  match_missing_info: unknown;
  match_rationale: unknown;
  approval_status: string;
  saved_candidate_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseQueryPlan(value: unknown): CandidateDiscoveryQueryPlan {
  if (!value || typeof value !== "object") {
    return { queries: [], vacancyTitle: "", locationHint: null, skillTerms: [] };
  }
  const obj = value as Record<string, unknown>;
  return {
    queries: parseStringArray(obj.queries),
    vacancyTitle: typeof obj.vacancyTitle === "string" ? obj.vacancyTitle : "",
    locationHint: typeof obj.locationHint === "string" ? obj.locationHint : null,
    skillTerms: parseStringArray(obj.skillTerms),
  };
}

function parseSearchAttempts(value: unknown): QuerySearchAttempt[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is QuerySearchAttempt => {
    return Boolean(item && typeof item === "object" && "query" in item);
  });
}

function parseBreakdown(value: unknown): CandidateMatchBreakdown {
  const defaults = { roleFit: 0, skillsFit: 0, locationFit: 0, experienceFit: 0, salaryFit: 0 };
  if (!value || typeof value !== "object") return defaults;
  const obj = value as Record<string, unknown>;
  return {
    roleFit: typeof obj.roleFit === "number" ? obj.roleFit : 0,
    skillsFit: typeof obj.skillsFit === "number" ? obj.skillsFit : 0,
    locationFit: typeof obj.locationFit === "number" ? obj.locationFit : 0,
    experienceFit: typeof obj.experienceFit === "number" ? obj.experienceFit : 0,
    salaryFit: typeof obj.salaryFit === "number" ? obj.salaryFit : 0,
  };
}

export function mapRunRowToDomain(row: CandidateDiscoveryRunRow): CandidateDiscoveryRun {
  return {
    id: row.id,
    organizationId: row.organization_id,
    vacancyId: row.vacancy_id,
    createdBy: row.created_by,
    status: row.status as CandidateDiscoveryRunStatus,
    queries: parseStringArray(row.queries),
    queryPlan: parseQueryPlan(row.query_plan),
    searchAttempts: parseSearchAttempts(row.search_attempts),
    providerMeta:
      row.provider_meta && typeof row.provider_meta === "object"
        ? (row.provider_meta as Record<string, unknown>)
        : {},
    proposalCount: row.proposal_count,
    belowThresholdCount: row.below_threshold_count,
    ineligibleCount: row.ineligible_count,
    duplicateUrlCount: row.duplicate_url_count,
    providerFailures: row.provider_failures,
    minMatchScoreUsed: row.min_match_score_used,
    errorCode: (row.error_code as CandidateDiscoveryErrorCode | null) ?? null,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    retentionExpiresAt: row.retention_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProposalRowToDomain(row: CandidateDiscoveryProposalRow): CandidateDiscoveryProposal {
  return {
    id: row.id,
    organizationId: row.organization_id,
    vacancyId: row.vacancy_id,
    runId: row.run_id,
    rank: row.rank,
    linkedinUrl: row.linkedin_url,
    linkedinProfileSlug: row.linkedin_profile_slug,
    firstName: row.first_name,
    lastName: row.last_name,
    candidateCurrentRole: row.candidate_current_role,
    location: row.location,
    summary: row.summary,
    skills: parseStringArray(row.skills),
    experienceYears: row.experience_years,
    unknownFields: parseStringArray(row.unknown_fields),
    sourceProvider: row.source_provider,
    sourceQuery: row.source_query,
    serpTitle: row.serp_title,
    serpSnippet: row.serp_snippet,
    matchScore: row.match_score,
    matchBreakdown: parseBreakdown(row.match_breakdown),
    matchStrongPoints: parseStringArray(row.match_strong_points),
    matchRisks: parseStringArray(row.match_risks),
    matchMissingInfo: parseStringArray(row.match_missing_info),
    matchRationale: parseStringArray(row.match_rationale),
    approvalStatus: row.approval_status as CandidateDiscoveryProposalStatus,
    savedCandidateId: row.saved_candidate_id,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rankedProposalToInsertRow(
  input: Omit<InsertProposalRowContext, "linkedin_url" | "linkedin_profile_slug"> & {
    linkedin_url: string;
    linkedin_profile_slug: string | null;
  },
): Omit<CandidateDiscoveryProposalRow, "id" | "created_at" | "updated_at"> {
  const ranked = input.ranked;
  return {
    organization_id: input.organization_id,
    vacancy_id: input.vacancy_id,
    run_id: input.run_id,
    rank: ranked.rank,
    linkedin_url: input.linkedin_url,
    linkedin_profile_slug: input.linkedin_profile_slug,
    first_name: ranked.profile.firstName,
    last_name: ranked.profile.lastName,
    candidate_current_role: ranked.profile.candidateCurrentRole,
    location: ranked.profile.location,
    summary: ranked.profile.summary,
    skills: ranked.profile.skills,
    experience_years: ranked.profile.experienceYears,
    unknown_fields: ranked.profile.unknownFields,
    source_provider: ranked.sourceProvider,
    source_query: ranked.sourceQuery,
    serp_title: ranked.profile.serpTitle,
    serp_snippet: ranked.profile.serpSnippet,
    match_score: ranked.match.matchScore,
    match_breakdown: ranked.match.breakdown,
    match_strong_points: ranked.match.strongPoints,
    match_risks: ranked.match.risks,
    match_missing_info: ranked.match.missingInfo,
    match_rationale: ranked.matchRationale,
    approval_status: "proposed",
    saved_candidate_id: null,
    reviewed_at: null,
    reviewed_by: null,
  };
}

type InsertProposalRowContext = {
  organization_id: string;
  vacancy_id: string;
  run_id: string;
  ranked: RankedCandidateProposal;
};

export function buildProposalInsertRows(input: {
  organizationId: string;
  vacancyId: string;
  runId: string;
  ranked: RankedCandidateProposal[];
}): Array<Omit<CandidateDiscoveryProposalRow, "id" | "created_at" | "updated_at">> {
  const rows: Array<Omit<CandidateDiscoveryProposalRow, "id" | "created_at" | "updated_at">> = [];

  for (const ranked of input.ranked) {
    const url = normalizeLinkedInProfileUrl(ranked.linkedinUrl);
    if (!url.ok) continue;

    rows.push(
      rankedProposalToInsertRow({
        organization_id: input.organizationId,
        vacancy_id: input.vacancyId,
        run_id: input.runId,
        ranked,
        linkedin_url: url.value.normalizedUrl,
        linkedin_profile_slug: url.value.profileSlug,
      }),
    );
  }

  return rows;
}