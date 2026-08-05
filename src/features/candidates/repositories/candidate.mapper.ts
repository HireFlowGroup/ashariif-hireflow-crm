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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
