import type {
  Candidate,
  CandidateContext,
  CandidateId,
  CreateCandidateFromDiscoveryInput,
  ListCandidatesInput,
  ListCandidatesResult,
} from "@/features/candidates/domain";
import type { CandidatesRepository } from "@/features/candidates/repositories/candidates.repository";
import { CandidatesServiceError } from "@/features/candidates/repositories/errors";

export class CandidatesService {
  constructor(private readonly repository: CandidatesRepository) {}

  async getCandidate(context: CandidateContext, candidateId: CandidateId): Promise<Candidate> {
    const candidate = await this.repository.getById(context.organizationId, candidateId);
    if (!candidate) {
      throw new CandidatesServiceError("Kandidaat niet gevonden.");
    }
    return candidate;
  }

  async listCandidates(
    context: CandidateContext,
    input: ListCandidatesInput = {},
  ): Promise<ListCandidatesResult> {
    return this.repository.list(context.organizationId, input);
  }

  async findByLinkedInUrl(context: CandidateContext, linkedinUrl: string): Promise<Candidate | null> {
    return this.repository.findByLinkedInUrl(context.organizationId, linkedinUrl);
  }

  async createFromDiscoveryProposal(
    context: CandidateContext,
    input: CreateCandidateFromDiscoveryInput,
  ): Promise<Candidate> {
    return this.repository.createFromDiscovery(context.organizationId, context.userId, input);
  }
}
