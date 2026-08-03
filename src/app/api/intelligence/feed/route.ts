import { NextResponse } from "next/server";

import { createIntelligenceFeedService } from "@/features/intelligence-feed/create-intelligence-feed-service";
import {
  decodeFeedCursor,
  parseFeedFilter,
  parseFeedSort,
} from "@/features/intelligence-feed/domain/feed.types";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = parseFeedFilter(searchParams.get("filter"));
  const sort = parseFeedSort(searchParams.get("sort"));
  const cursor = decodeFeedCursor(searchParams.get("cursor"));
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const service = await createIntelligenceFeedService();
  const page = await service.getPage(context.organizationId, {
    filter,
    sort,
    cursor,
    limit,
  });

  return NextResponse.json(page);
}
