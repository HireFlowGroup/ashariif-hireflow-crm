import { NextResponse } from "next/server";

import { CandidateDiscoveryError } from "@/features/candidate-discovery/domain/candidate-discovery.errors";
import { executeCandidateSourcingRun } from "@/features/candidate-discovery/services/candidate-discovery-orchestrator.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { candidateSourcingSearchBodySchema } from "@/lib/validations/candidate-sourcing-api";

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const parsed = candidateSourcingSearchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" },
      { status: 400 },
    );
  }

  try {
    const result = await executeCandidateSourcingRun(context, parsed.data);
    return NextResponse.json({
      run: result.run,
      proposals: result.proposals,
    });
  } catch (error) {
    if (error instanceof CandidateDiscoveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    console.error("[CandidateSourcing] search failed", error);
    return NextResponse.json({ error: "Kandidaat sourcing mislukt." }, { status: 500 });
  }
}