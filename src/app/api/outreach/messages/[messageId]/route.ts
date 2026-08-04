import { NextResponse } from "next/server";

import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

type RouteContext = { params: Promise<{ messageId: string }> };

export async function GET(_request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { messageId } = await routeContext.params;
  const engine = await createOutreachEngineService();
  const messages = await engine.listMessages(context);
  const message = messages.find((m) => m.id === messageId);

  if (!message) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  return NextResponse.json({ message });
}

export async function PATCH(request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { messageId } = await routeContext.params;
  const body = (await request.json()) as { subject?: string; bodyText?: string };

  try {
    const engine = await createOutreachEngineService();
    const message = await engine.updateDraft(context, messageId, body);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof OutreachEngineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    return NextResponse.json({ error: "Bewerken mislukt" }, { status: 500 });
  }
}
