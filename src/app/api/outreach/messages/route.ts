import { NextResponse } from "next/server";

import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export async function GET(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const statuses = statusParam ? statusParam.split(",") : undefined;

  const engine = await createOutreachEngineService();
  const messages = await engine.listMessages(
    context,
    statuses as never,
  );

  return NextResponse.json({ messages });
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  let body: { companyId?: string; campaignId?: string; contactId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  if (!body.companyId) {
    return NextResponse.json({ error: "companyId is verplicht" }, { status: 400 });
  }

  try {
    const engine = await createOutreachEngineService();
    const message = await engine.createDraft(context, {
      companyId: body.companyId,
      campaignId: body.campaignId,
      contactId: body.contactId,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof OutreachEngineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    return NextResponse.json({ error: "Concept kon niet worden aangemaakt" }, { status: 500 });
  }
}
