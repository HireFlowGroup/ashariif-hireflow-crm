import { NextResponse } from "next/server";

import { createCandidateDiscoveryRepository } from "@/features/candidate-discovery/create-candidate-discovery-repository";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { runIdParamsSchema } from "@/lib/validations/candidate-sourcing-api";

type RouteParams = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const routeParams = await params;
  const parsed = runIdParamsSchema.safeParse(routeParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige run" }, { status: 400 });
  }

  const repo = await createCandidateDiscoveryRepository();
  const run = await repo.getRun(context.organizationId, parsed.data.runId);
  if (!run) {
    return NextResponse.json({ error: "Run niet gevonden" }, { status: 404 });
  }

  const proposals = await repo.listProposalsByRun(context.organizationId, run.id);
  return NextResponse.json({ run, proposals });
}