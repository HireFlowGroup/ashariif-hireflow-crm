import { NextResponse } from "next/server";

import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

type RouteContext = { params: Promise<{ messageId: string }> };

export async function POST(_request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { messageId } = await routeContext.params;

  try {
    const engine = await createOutreachEngineService();
    const message = await engine.rejectMessage(context, messageId);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof OutreachEngineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    return NextResponse.json({ error: "Afwijzen mislukt" }, { status: 500 });
  }
}
