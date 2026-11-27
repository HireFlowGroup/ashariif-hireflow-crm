import { NextResponse } from "next/server";

import { saveCandidateDiscoveryProposal } from "@/features/candidate-discovery/services/candidate-proposal-save.service";
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

  try {
    const result = await saveCandidateDiscoveryProposal(context, parsed.data.proposalId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[CandidateSourcing] save failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Opslaan mislukt" },
      { status: 500 },
    );
  }
}