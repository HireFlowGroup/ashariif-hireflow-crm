import { NextResponse } from "next/server";

import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

type RouteContext = { params: Promise<{ messageId: string }> };

export async function POST(request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { messageId } = await routeContext.params;
  const body = (await request.json()) as {
    confirmed?: boolean;
    testRecipientEmail?: string;
  };

  if (!body.confirmed) {
    return NextResponse.json(
      { error: "Expliciete bevestiging vereist (confirmed: true)." },
      { status: 400 },
    );
  }

  try {
    const engine = await createOutreachEngineService();
    const message = await engine.sendMessage(context, {
      messageId,
      confirmedByUser: true,
      isTest: Boolean(body.testRecipientEmail),
      testRecipientEmail: body.testRecipientEmail,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof OutreachEngineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    return NextResponse.json({ error: "Verzenden mislukt" }, { status: 500 });
  }
}
