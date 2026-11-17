import type {
  CandidateDiscoveryProposal,
  CandidateDiscoveryRun,
  CreateCandidateDiscoveryRunInput,
  InsertProposalsFromRankInput,
  InsertProposalsResult,
  UpdateCandidateDiscoveryRunInput,
  UpdateProposalStatusInput,
} from "@/features/candidate-discovery/domain/candidate-discovery.persistence.types";

export interface CandidateDiscoveryRepository {
  createRun(input: CreateCandidateDiscoveryRunInput): Promise<CandidateDiscoveryRun>;
  updateRun(
    organizationId: string,
    runId: string,
    patch: UpdateCandidateDiscoveryRunInput,
  ): Promise<CandidateDiscoveryRun>;
  getRun(organizationId: string, runId: string): Promise<CandidateDiscoveryRun | null>;
  listRunsForVacancy(
    organizationId: string,
    vacancyId: string,
    limit?: number,
  ): Promise<CandidateDiscoveryRun[]>;
  insertProposals(input: InsertProposalsFromRankInput): Promise<InsertProposalsResult>;
  listProposalsByRun(organizationId: string, runId: string): Promise<CandidateDiscoveryProposal[]>;
  updateProposalStatus(input: UpdateProposalStatusInput): Promise<CandidateDiscoveryProposal>;
}