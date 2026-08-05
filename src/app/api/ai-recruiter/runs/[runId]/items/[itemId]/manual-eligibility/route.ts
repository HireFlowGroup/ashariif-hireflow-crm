import { NextResponse } from "next/server";
import { z } from "zod";

import { applyManualEligibilityOverride } from "@/features/ai-recruiter/services/manual-eligibility.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";

type RouteContext = { params: Promise<{ runId: string; itemId: string }> };

const itemIdSchema = z.string().uuid("Ongeldige itemId");

export async function POST(_request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { runId: rawRunId, itemId: rawItemId } = await routeContext.params;
  const runIdResult = aiRecruiterRunIdParamSchema.safeParse(rawRunId);
  const itemIdResult = itemIdSchema.safeParse(rawItemId);

  if (!runIdResult.success || !itemIdResult.success) {
    return NextResponse.json({ error: "Ongeldige parameters" }, { status: 400 });
  }

  try {
    const result = await applyManualEligibilityOverride(
      context,
      runIdResult.data,
      itemIdResult.data,
    );

    return NextResponse.json({
      item: result.item,
      draftCreated: result.draftCreated,
      message: result.draftCreated
        ? "Handmatige override toegepast — concept aangemaakt"
        : "Handmatige override toegepast",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Override mislukt" },
      { status: 422 },
    );
  }
}
