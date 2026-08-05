import { NextResponse } from "next/server";

import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { parseAiRecruiterSearchPlan } from "@/features/ai-recruiter/services/search-plan-parser.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterParsePlanBodySchema } from "@/lib/validations/ai-recruiter-api";

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const parsed = aiRecruiterParsePlanBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige prompt" }, { status: 400 });
  }

  try {
    const plan = await parseAiRecruiterSearchPlan(parsed.data.prompt);
    const validated = aiRecruiterSearchPlanSchema.safeParse(plan);

    if (!validated.success) {
      console.error("[AI Recruiter] parse-plan schema mismatch", validated.error.flatten());
      return NextResponse.json({ error: "Zoekplan validatie mislukt." }, { status: 500 });
    }

    return NextResponse.json({ plan: validated.data, prompt: parsed.data.prompt });
  } catch (error) {
    console.error("[AI Recruiter] parse-plan failed", error);
    const message = error instanceof Error ? error.message : "Plan kon niet worden geparsed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
