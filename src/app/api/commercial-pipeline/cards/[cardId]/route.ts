import { NextResponse } from "next/server";

import { createCommercialPipelineService } from "@/features/commercial-pipeline/create-commercial-pipeline-service";
import { CommercialPipelineRepositoryError } from "@/features/commercial-pipeline/repositories/commercial-pipeline.repository";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { movePipelineCardBodySchema } from "@/lib/validations/commercial-pipeline-api";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

type RouteContext = {
  params: Promise<{ cardId: string }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const auth = await getAuthenticatedServiceContext();

  if (!auth) {
    return jsonError("Je bent niet ingelogd.", 401);
  }

  const { cardId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ongeldige JSON-body.", 400);
  }

  const parsed = movePipelineCardBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    return jsonError(message, 400);
  }

  try {
    const service = await createCommercialPipelineService();
    const card = await service.moveCard(auth.organizationId, cardId, parsed.data);
    return NextResponse.json(card, { headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof CommercialPipelineRepositoryError) {
      const status = error.message.includes("niet gevonden") ? 404 : 500;
      return jsonError(error.message, status);
    }
    return jsonError("Kon kaart niet verplaatsen.", 500);
  }
}
