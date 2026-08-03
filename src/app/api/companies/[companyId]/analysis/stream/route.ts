import { createCompanyAnalysisService } from "@/features/company-ai-analysis/create-company-analysis-service";
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
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const service = await createCompanyAnalysisService();

      send("connected", { companyId });

      while (Date.now() - startedAt < MAX_DURATION_MS) {
        if (request.signal.aborted) break;

        try {
          const payload = await service.getAnalysis(context, companyId);

          if (payload.isStale) {
            const refreshed = await service.ensureFreshAnalysis(context, companyId);
            send("analysis", {
              analysis: refreshed,
              isStale: false,
              generatedAt: new Date().toISOString(),
            });
          } else {
            send("analysis", payload);
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
