import { NextResponse } from "next/server";

import { createDashboardService } from "@/features/dashboard/create-dashboard-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { parseDashboardFilters } from "@/lib/dashboard/filters";
import {
  DASHBOARD_STREAM_FORMAT_HEADER,
  DASHBOARD_STREAM_FORMAT_NDJSON,
  encodeDashboardStreamEvent,
} from "@/lib/dashboard/stream-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STREAM_INTERVAL_MS = 15_000;
const MAX_STREAM_DURATION_MS = 5 * 60_000;

export async function GET(request: Request) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filters = parseDashboardFilters({
    period: searchParams.get("period") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    sector: searchParams.get("sector") ?? undefined,
  });

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const dashboardService = await createDashboardService();
      const serviceContext = { ...context };

      async function pushSnapshot() {
        try {
          const snapshot = await dashboardService.getSnapshot(serviceContext, filters);
          controller.enqueue(
            encoder.encode(encodeDashboardStreamEvent({ type: "snapshot", snapshot })),
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              encodeDashboardStreamEvent({
                type: "error",
                message: error instanceof Error ? error.message : "Stream fout",
              }),
            ),
          );
        }
      }

      await pushSnapshot();

      const interval = setInterval(async () => {
        if (Date.now() - startedAt >= MAX_STREAM_DURATION_MS) {
          clearInterval(interval);
          controller.close();
          return;
        }

        controller.enqueue(
          encoder.encode(
            encodeDashboardStreamEvent({ type: "heartbeat", at: new Date().toISOString() }),
          ),
        );
        await pushSnapshot();
      }, STREAM_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      [DASHBOARD_STREAM_FORMAT_HEADER]: DASHBOARD_STREAM_FORMAT_NDJSON,
    },
  });
}
