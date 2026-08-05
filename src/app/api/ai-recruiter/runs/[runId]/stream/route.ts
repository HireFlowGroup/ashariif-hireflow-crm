import { createAiRecruiterOrchestrator } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import {
  encodeRecruiterStreamEvent,
  RECRUITER_STREAM_FORMAT_HEADER,
  RECRUITER_STREAM_FORMAT_SSE,
} from "@/lib/ai-recruiter/stream-sse";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";

type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, routeContext: RouteContext): Promise<Response> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { runId: rawRunId } = await routeContext.params;
  const runIdResult = aiRecruiterRunIdParamSchema.safeParse(rawRunId);

  if (!runIdResult.success) {
    return new Response(JSON.stringify({ error: runIdResult.error.issues[0]?.message ?? "Ongeldige runId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const runId = runIdResult.data;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      let terminal = false;

      try {
        const orchestrator = await createAiRecruiterOrchestrator();

        for await (const event of orchestrator.runSession(context, runId)) {
          write(encodeRecruiterStreamEvent(event));
          if (event.type === "complete" || event.type === "error") {
            terminal = event.type === "complete";
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stream mislukt";
        write(encodeRecruiterStreamEvent({ type: "error", message }));
      } finally {
        if (!terminal) {
          write(encodeRecruiterStreamEvent({ type: "error", message: "Stream beëindigd zonder terminal status" }));
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      [RECRUITER_STREAM_FORMAT_HEADER]: RECRUITER_STREAM_FORMAT_SSE,
    },
  });
}
