import type { Database } from "@/types/database";
import type { Candidate, CandidateId, CandidateStatus } from "@/features/candidates/domain";
import { toCandidateId } from "@/features/candidates/domain";

type CandidateRow = Database["public"]["Tables"]["candidates"]["Row"] & {
  candidate_current_role?: string | null;
  location?: string | null;
  summary?: string | null;
  skills?: unknown;
  experience_years?: number | null;
  salary_expectation_min?: number | null;
  salary_expectation_max?: number | null;
  availability?: string | null;
  owner_id?: string | null;
  linkedin_url?: string | null;
};

function parseSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function mapCandidateRowToDomain(row: CandidateRow): Candidate {
  return {
    id: toCandidateId(row.id),
    organizationId: row.organization_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    status: row.status as CandidateStatus,
    candidateCurrentRole: row.candidate_current_role ?? null,
    location: row.location ?? null,
    summary: row.summary ?? null,
    skills: parseSkills(row.skills),
    experienceYears: row.experience_years ?? null,
    salaryExpectationMin: row.salary_expectation_min ?? null,
    salaryExpectationMax: row.salary_expectation_max ?? null,
    availability: row.availability ?? null,
    ownerId: row.owner_id ?? null,
    linkedinUrl: row.linkedin_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildCandidateInsertFromDiscovery(input: {
  organizationId: string;
  ownerId: string;
  proposal: {
    firstName: string;
    lastName: string;
    candidateCurrentRole: string | null;
    location: string | null;
    summary: string | null;
    skills: string[];
    experienceYears: number | null;
    linkedinUrl: string;
    sourceProvider: string | null;
    matchScore: number;
  };
}): CandidateRow {
  const verified = new Date().toISOString();
  return {
    organization_id: input.organizationId,
    first_name: input.proposal.firstName,
    last_name: input.proposal.lastName,
    email: null,
    phone: null,
    source: `linkedin_xray:${input.proposal.sourceProvider ?? "serp"}`,
    status: "new",
    candidate_current_role: input.proposal.candidateCurrentRole,
    location: input.proposal.location,
    summary:
      [
        input.proposal.summary,
        `LinkedIn (geverifieerd ${verified.slice(0, 10)}): ${input.proposal.linkedinUrl}`,
        `Matchscore bij sourcing: ${input.proposal.matchScore}`,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 4000) || null,
    skills: input.proposal.skills,
    experience_years: input.proposal.experienceYears,
    salary_expectation_min: null,
    salary_expectation_max: null,
    availability: null,
    owner_id: input.ownerId,
    linkedin_url: input.proposal.linkedinUrl,
  } as CandidateRow;
}
