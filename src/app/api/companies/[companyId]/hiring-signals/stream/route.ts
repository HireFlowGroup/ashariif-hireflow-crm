import { createHiringSignalsTimelineService } from "@/features/hiring-signals-timeline/create-hiring-signals-timeline-service";
import { parseTimelineFilter } from "@/features/hiring-signals-timeline/domain/timeline.types";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 12_000;
const MAX_DURATION_MS = 5 * 60_000;

type RouteContext = { params: Promise<{ companyId: string }> };

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), { status: 401 });
  }

  const { companyId } = await routeContext.params;
  const { searchParams } = new URL(request.url);
  const filter = parseTimelineFilter(searchParams.get("filter"));

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let lastWatermark: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const service = await createHiringSignalsTimelineService();

      send("connected", { companyId, filter });

      while (Date.now() - startedAt < MAX_DURATION_MS) {
        if (request.signal.aborted) break;

        try {
          const watermark = await service.getWatermark(context, companyId);

          if (watermark !== lastWatermark) {
            const timeline = await service.getTimeline(context, companyId, filter);
            lastWatermark = watermark;
            send("timeline", timeline);
          } else {
            send("heartbeat", { at: new Date().toISOString() });
          }
        } catch (error) {
          send("error", {
            message: error instanceof Error ? error.message : "Stream fout",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      controller.close();
    },
  });

  request.signal.addEventListener("abort", () => {
    // ReadableStream close handled by loop exit
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
