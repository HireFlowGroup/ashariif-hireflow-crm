import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiRecruiterOrchestrator } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  prompt: z.string().min(10).max(4000),
  searchPlan: aiRecruiterSearchPlanSchema,
});

export async function GET(): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const orchestrator = await createAiRecruiterOrchestrator();
  const runs = await orchestrator.listRuns(context);

  return NextResponse.json({ runs });
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige input" }, { status: 400 });
  }

  const orchestrator = await createAiRecruiterOrchestrator();
  const run = await orchestrator.createRun(context, parsed.data);

  return NextResponse.json({ run }, { status: 201 });
}
