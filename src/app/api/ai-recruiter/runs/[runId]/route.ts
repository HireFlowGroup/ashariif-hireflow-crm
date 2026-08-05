import { NextResponse } from "next/server";

import {
  createAiRecruiterRepository,
} from "@/features/ai-recruiter/create-ai-recruiter-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";

type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { runId: rawRunId } = await routeContext.params;
  const runIdResult = aiRecruiterRunIdParamSchema.safeParse(rawRunId);

  if (!runIdResult.success) {
    return NextResponse.json(
      { error: runIdResult.error.issues[0]?.message ?? "Ongeldige runId" },
      { status: 400 },
    );
  }

  try {
    const repository = await createAiRecruiterRepository();
    const runId = runIdResult.data;
    const [run, items] = await Promise.all([
      repository.getRun(context.organizationId, runId),
      repository.listRunItems(context.organizationId, runId),
    ]);

    if (!run) return NextResponse.json({ error: "Run niet gevonden" }, { status: 404 });

    return NextResponse.json({ run, items });
  } catch (error) {
    console.error("[AI Recruiter] GET /runs/[runId] failed", { runId: rawRunId, error });
    const message = error instanceof Error ? error.message : "Run laden mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
