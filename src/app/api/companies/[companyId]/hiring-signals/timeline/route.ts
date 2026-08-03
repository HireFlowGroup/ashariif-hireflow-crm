import { NextResponse } from "next/server";

import { createHiringSignalsTimelineService } from "@/features/hiring-signals-timeline/create-hiring-signals-timeline-service";
import { parseTimelineFilter } from "@/features/hiring-signals-timeline/domain/timeline.types";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ companyId: string }> };

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { companyId } = await routeContext.params;
  const { searchParams } = new URL(request.url);
  const filter = parseTimelineFilter(searchParams.get("filter"));

  const service = await createHiringSignalsTimelineService();
  const timeline = await service.getTimeline(context, companyId, filter);

  return NextResponse.json(timeline);
}
