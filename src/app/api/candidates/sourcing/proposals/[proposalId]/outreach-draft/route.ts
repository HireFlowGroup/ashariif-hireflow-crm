import { NextResponse } from "next/server";

import { createCandidateDiscoveryRepository } from "@/features/candidate-discovery/create-candidate-discovery-repository";
import { buildCandidateSourcingOutreachDraft } from "@/features/candidate-discovery/services/candidate-sourcing-outreach-draft.service";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { toVacancyId } from "@/features/vacancies/domain";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { proposalIdParamsSchema } from "@/lib/validations/candidate-sourcing-api";

type RouteParams = { params: Promise<{ proposalId: string }> };

export async function POST(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const routeParams = await params;
  const parsed = proposalIdParamsSchema.safeParse(routeParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldig voorstel" }, { status: 400 });
  }

  const repo = await createCandidateDiscoveryRepository();
  const proposal = await repo.getProposal(context.organizationId, parsed.data.proposalId);
  if (!proposal) {
    return NextResponse.json({ error: "Voorstel niet gevonden" }, { status: 404 });
  }

  const vacanciesService = await createVacanciesService();
  const vacancy = await vacanciesService.getVacancy(context, toVacancyId(proposal.vacancyId));
  const draft = buildCandidateSourcingOutreachDraft(proposal, vacancy);

  return NextResponse.json({ draft, proposalId: proposal.id, vacancyId: vacancy.id });
}