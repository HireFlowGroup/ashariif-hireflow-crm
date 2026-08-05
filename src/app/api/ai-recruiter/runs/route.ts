import { NextResponse } from "next/server";

import {
  createAiRecruiterRun,
  createAiRecruiterRepository,
} from "@/features/ai-recruiter/create-ai-recruiter-service";
import { aiRecruiterRunSchema } from "@/features/ai-recruiter/validation/search-plan.schemas";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export async function GET(): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  try {
    const repository = await createAiRecruiterRepository();
    const runs = await repository.listRuns(context.organizationId);
    return NextResponse.json({ runs });
  } catch (error) {
    console.error("[AI Recruiter] GET /runs failed", error);
    const message = error instanceof Error ? error.message : "Runs laden mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  const parsed = aiRecruiterRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige input" }, { status: 400 });
  }

  try {
    const run = await createAiRecruiterRun(context, parsed.data);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    console.error("[AI Recruiter] POST /runs failed", error);
    const message = error instanceof Error ? error.message : "Run aanmaken mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
