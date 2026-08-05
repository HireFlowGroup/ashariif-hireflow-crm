import type { Candidate, CandidateId, ListCandidatesInput, ListCandidatesResult } from "@/features/candidates/domain";

export interface CandidatesRepository {
  getById(organizationId: string, candidateId: CandidateId): Promise<Candidate | null>;
  list(organizationId: string, input: ListCandidatesInput): Promise<ListCandidatesResult>;
}
