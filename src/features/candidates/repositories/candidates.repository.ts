import type {
  Candidate,
  CandidateId,
  CreateCandidateFromDiscoveryInput,
  ListCandidatesInput,
  ListCandidatesResult,
} from "@/features/candidates/domain";

export interface CandidatesRepository {
  getById(organizationId: string, candidateId: CandidateId): Promise<Candidate | null>;
  list(organizationId: string, input: ListCandidatesInput): Promise<ListCandidatesResult>;
  findByLinkedInUrl(organizationId: string, linkedinUrl: string): Promise<Candidate | null>;
  createFromDiscovery(
    organizationId: string,
    userId: string,
    input: CreateCandidateFromDiscoveryInput,
  ): Promise<Candidate>;
}
