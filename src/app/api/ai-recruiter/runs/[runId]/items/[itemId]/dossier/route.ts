import { NextResponse } from "next/server";
import { z } from "zod";

import { createProspectDossierService } from "@/features/ai-recruiter/create-prospect-dossier-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";

type RouteContext = { params: Promise<{ runId: string; itemId: string }> };

const itemIdSchema = z.string().uuid("Ongeldige itemId");

export async function GET(_request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { runId: rawRunId, itemId: rawItemId } = await routeContext.params;
  const runIdResult = aiRecruiterRunIdParamSchema.safeParse(rawRunId);
  const itemIdResult = itemIdSchema.safeParse(rawItemId);

  if (!runIdResult.success || !itemIdResult.success) {
    return NextResponse.json({ error: "Ongeldige parameters" }, { status: 400 });
  }

  try {
    const service = await createProspectDossierService();
    const dossier = await service.loadDossier(context, runIdResult.data, itemIdResult.data);

    if (!dossier) {
      return NextResponse.json({ error: "Prospect niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ dossier });
  } catch (error) {
    console.error("[AI Recruiter] GET dossier failed", { runId: rawRunId, itemId: rawItemId, error });
    const message = error instanceof Error ? error.message : "Dossier laden mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
