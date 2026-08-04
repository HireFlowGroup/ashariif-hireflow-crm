import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiRecruiterOrchestrator } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

const bodySchema = z.object({ prompt: z.string().min(10).max(4000) });

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige prompt" }, { status: 400 });
  }

  const orchestrator = await createAiRecruiterOrchestrator();
  const plan = await orchestrator.parsePlan(parsed.data.prompt);
  const validated = aiRecruiterSearchPlanSchema.parse(plan);

  return NextResponse.json({ plan: validated, prompt: parsed.data.prompt });
}
