import { NextResponse } from "next/server";

import { createAiRecruiterOrchestrator } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

type RouteContext = { params: Promise<{ runId: string }> };

export async function POST(_request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { runId } = await routeContext.params;
  const orchestrator = await createAiRecruiterOrchestrator();
  const run = await orchestrator.cancelRun(context, runId);

  return NextResponse.json({ run });
}
