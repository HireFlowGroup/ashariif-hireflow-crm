import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { createRecruitmentIntelligenceEngine } from "@/features/recruitment-intelligence/create-recruitment-intelligence-engine";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";

type RouteContext = { params: Promise<{ runId: string; itemId: string }> };

const itemIdSchema = z.string().uuid("Ongeldige itemId");

export async function POST(_request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { runId: rawRunId, itemId: rawItemId } = await routeContext.params;
  const runIdResult = aiRecruiterRunIdParamSchema.safeParse(rawRunId);
  const itemIdResult = itemIdSchema.safeParse(rawItemId);

  if (!runIdResult.success || !itemIdResult.success) {
    return NextResponse.json({ error: "Ongeldige parameters" }, { status: 400 });
  }

  try {
    const repository = await createAiRecruiterRepository();
    const item = await repository.getRunItem(context.organizationId, itemIdResult.data);

    if (!item || item.runId !== runIdResult.data) {
      return NextResponse.json({ error: "Prospect niet gevonden" }, { status: 404 });
    }

    if (!item.companyId) {
      return NextResponse.json({ error: "Geen bedrijf gekoppeld." }, { status: 422 });
    }

    const engine = await createRecruitmentIntelligenceEngine();
    const record = await engine.ensureFreshAnalysis(context, item.companyId, {
      force: true,
      runItemId: item.id,
    });

    if (!record) {
      return NextResponse.json({ error: "Analyse kon niet worden gegenereerd." }, { status: 422 });
    }

    return NextResponse.json({ analysis: record.analysis, record });
  } catch (error) {
    console.error("[AI Recruiter] POST analysis failed", { error });
    const message = error instanceof Error ? error.message : "Analyse genereren mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
