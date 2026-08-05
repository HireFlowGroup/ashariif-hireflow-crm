import { NextResponse } from "next/server";

import { parseAiRecruiterSearchPlan, SearchPlanParserError } from "@/features/ai-recruiter/services/search-plan-parser.service";
import { aiRecruiterPlanSchema } from "@/features/ai-recruiter/validation/search-plan.schemas";
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

  console.log("[AI Recruiter] parse-plan API prompt:", parsed.data.prompt);

  try {
    const plan = await parseAiRecruiterSearchPlan(parsed.data.prompt);
    const validated = aiRecruiterPlanSchema.safeParse(plan);

    if (!validated.success) {
      console.error("[AI Recruiter] parse-plan final schema mismatch", validated.error.flatten());
      console.log("[AI Recruiter] schemaErrors:", validated.error.issues);
      return NextResponse.json({ error: "Zoekplan validatie mislukt." }, { status: 500 });
    }

    return NextResponse.json({ plan: validated.data, prompt: parsed.data.prompt });
  } catch (error) {
    if (error instanceof SearchPlanParserError) {
      console.error("[AI Recruiter] parse-plan failed", {
        code: error.code,
        message: error.message,
        issues: error.issues,
      });
      console.log("[AI Recruiter] schemaErrors:", error.issues);
      return NextResponse.json(
        {
          error: error.message,
          issues: error.issues?.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 422 },
      );
    }

    console.error("[AI Recruiter] parse-plan unexpected error", error);
    const message = error instanceof Error ? error.message : "Plan kon niet worden geparsed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
