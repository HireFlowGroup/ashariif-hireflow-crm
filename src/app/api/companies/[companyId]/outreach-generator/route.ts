import { NextResponse } from "next/server";
import { z } from "zod";

import { createOutreachGeneratorService } from "@/features/outreach-generator/create-outreach-generator-service";
import { parseOutreachGeneratorStyleParam } from "@/features/outreach-generator/services/outreach-generator.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ companyId: string }> };

const generateBodySchema = z.object({
  style: z.enum(["formal", "friendly", "direct", "consultative"]).optional(),
  contactId: z.string().uuid().nullable().optional(),
  force: z.boolean().optional(),
});

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { companyId } = await routeContext.params;
  const { searchParams } = new URL(request.url);
  const style = parseOutreachGeneratorStyleParam(searchParams.get("style"));

  const service = await createOutreachGeneratorService();
  const result = await service.getGeneration(context, companyId, style);

  return NextResponse.json(result);
}

export async function POST(request: Request, routeContext: RouteContext) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { companyId } = await routeContext.params;

  let body: z.infer<typeof generateBodySchema> = {};
  try {
    const raw = await request.json();
    body = generateBodySchema.parse(raw);
  } catch {
    body = {};
  }

  const service = await createOutreachGeneratorService();

  try {
    const generation = await service.generate(context, companyId, {
      style: body.style,
      contactId: body.contactId,
      force: body.force ?? true,
    });

    return NextResponse.json({ generation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Genereren mislukt";
    const status = message.includes("niet gevonden") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
