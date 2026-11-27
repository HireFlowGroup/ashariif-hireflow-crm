import "server-only";

import type { CandidateContext, CandidateId } from "@/features/candidates/domain";
import { toCandidateId } from "@/features/candidates/domain";
import { createCandidateDiscoveryRepository } from "@/features/candidate-discovery/create-candidate-discovery-repository";
import type { CandidateDiscoveryProposal } from "@/features/candidate-discovery/domain/candidate-discovery.persistence.types";
import { createCandidatesServiceFromClient } from "@/features/candidates/create-candidates-service";
import { toVacancyId } from "@/features/vacancies/domain";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type SaveProposalResult = {
  proposal: CandidateDiscoveryProposal;
  candidateId: CandidateId;
  pipelineLinked: boolean;
};

export async function saveCandidateDiscoveryProposal(
  context: CandidateContext,
  proposalId: string,
): Promise<SaveProposalResult> {
  const client = await createClient();
  const discoveryRepo = await createCandidateDiscoveryRepository();
  const candidatesService = createCandidatesServiceFromClient(client);

  const proposal = await discoveryRepo.getProposal(context.organizationId, proposalId);
  if (!proposal) {
    throw new Error("Voorstel niet gevonden.");
  }

  const existing = await candidatesService.findByLinkedInUrl(context, proposal.linkedinUrl);

  const candidate =
    existing
    ?? (await candidatesService.createFromDiscoveryProposal(context, {
      proposal,
      vacancyId: toVacancyId(proposal.vacancyId),
    }));

  const updated = await discoveryRepo.updateProposalStatus({
    proposalId,
    organizationId: context.organizationId,
    approvalStatus: "saved",
    reviewedBy: context.userId,
    savedCandidateId: candidate.id,
  });

  const pipelineLinked = await linkPipelineEntry(client, {
    organizationId: context.organizationId,
    vacancyId: proposal.vacancyId,
    candidateId: candidate.id,
  });

  return { proposal: updated, candidateId: toCandidateId(candidate.id), pipelineLinked };
}

async function linkPipelineEntry(
  client: Awaited<ReturnType<typeof createClient>>,
  input: { organizationId: string; vacancyId: string; candidateId: string },
): Promise<boolean> {
  const row: Database["public"]["Tables"]["pipeline_entries"]["Insert"] = {
    organization_id: input.organizationId,
    vacancy_id: input.vacancyId,
    candidate_id: input.candidateId,
    stage: "screening",
    position: 0,
  };

  const { error } = await client.from("pipeline_entries").insert(row as never);
  if (error?.code === "23505") return true;
  if (error) return false;
  return true;
}