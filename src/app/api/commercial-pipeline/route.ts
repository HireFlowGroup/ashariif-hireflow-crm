import { NextResponse } from "next/server";

import { createCommercialPipelineService } from "@/features/commercial-pipeline/create-commercial-pipeline-service";
import { CommercialPipelineServiceError } from "@/features/commercial-pipeline/services/errors";
import { CommercialPipelineRepositoryError } from "@/features/commercial-pipeline/repositories/commercial-pipeline.repository";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import {
  createPipelineCardBodySchema,
  syncPipelineBodySchema,
} from "@/lib/validations/commercial-pipeline-api";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

export async function GET(): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return jsonError("Je bent niet ingelogd.", 401);
  }

  try {
    const service = await createCommercialPipelineService();
    const board = await service.getBoard(context.organizationId);
    return NextResponse.json(board, { headers: JSON_HEADERS });
  } catch (error) {
    const message =
      error instanceof CommercialPipelineRepositoryError
        ? error.message
        : "Kon commerciële pipeline niet laden.";
    return jsonError(message, 500);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return jsonError("Je bent niet ingelogd.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ongeldige JSON-body.", 400);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "sync") {
    const parsed = syncPipelineBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return jsonError("Ongeldige sync-aanvraag.", 400);
    }

    try {
      const service = await createCommercialPipelineService();
      const result = await service.syncCompanies(context.organizationId);
      return NextResponse.json(result, { headers: JSON_HEADERS });
    } catch (error) {
      const message =
        error instanceof CommercialPipelineRepositoryError
          ? error.message
          : "Synchronisatie mislukt.";
      return jsonError(message, 500);
    }
  }

  const parsed = createPipelineCardBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    return jsonError(message, 400);
  }

  try {
    const service = await createCommercialPipelineService();
    const card = await service.createCard(context.organizationId, parsed.data);
    return NextResponse.json(card, { status: 201, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof CommercialPipelineServiceError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof CommercialPipelineRepositoryError) {
      const status = error.message.includes("duplicate") ? 409 : 500;
      return jsonError(error.message, status);
    }
    return jsonError("Kon pipeline-kaart niet aanmaken.", 500);
  }
}
