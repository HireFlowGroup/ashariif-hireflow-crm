import { createIntelligenceFeedService } from "@/features/intelligence-feed/create-intelligence-feed-service";
import {
  parseFeedFilter,
  parseFeedSort,
} from "@/features/intelligence-feed/domain/feed.types";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 12_000;
const MAX_DURATION_MS = 5 * 60_000;

export async function GET(request: Request) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = parseFeedFilter(searchParams.get("filter"));
  const sort = parseFeedSort(searchParams.get("sort"));

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let lastWatermark: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const service = await createIntelligenceFeedService();

      send("connected", { filter, sort });

      while (Date.now() - startedAt < MAX_DURATION_MS) {
        if (request.signal.aborted) break;

        try {
          const watermark = await service.getWatermark(context.organizationId);

          if (watermark !== lastWatermark) {
            const page = await service.getPage(context.organizationId, {
              filter,
              sort,
              cursor: null,
              limit: 30,
            });
            lastWatermark = watermark;
            send("feed", page);
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
