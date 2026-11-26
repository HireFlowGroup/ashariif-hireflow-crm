import { NextResponse } from "next/server";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { buildProspectEvidenceQueue } from "@/features/ai-recruiter/services/prospect-evidence-queue.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { runId } = await params;
  const repository = await createAiRecruiterRepository();

  try {
    const [run, items] = await Promise.all([
      repository.getRun(context.organizationId, runId),
      repository.listRunItems(context.organizationId, runId),
    ]);

    if (!run) {
      return NextResponse.json({ error: "Run niet gevonden" }, { status: 404 });
    }

    const queue = buildProspectEvidenceQueue(items);
  const pipelineFunnel = run.settings.pipelineFunnel ?? null;

    return NextResponse.json({
      queue,
      pipelineFunnel,
      note: "Geen automatische achtergrondruns — handmatige verificatie vereist.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Evidence queue laden mislukt" },
      { status: 500 },
    );
  }
}