import { createCompanyFinderService } from "@/features/company-finder/create-company-finder-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";
import {
  encodeCandidateEvent,
  encodeCompanyFinderSseEvent,
  encodeCompleteEvent,
  encodeErrorEvent,
  encodePipelineEvent,
  encodeProgressEvent,
  FINDER_STREAM_FORMAT_HEADER,
  FINDER_STREAM_FORMAT_SSE,
  toCandidateStreamEvent,
} from "@/lib/company-finder/stream-sse";

export async function GET(
  _request: Request,
  contextParams: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return new Response(JSON.stringify({ error: "Je bent niet ingelogd." }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const { jobId } = await contextParams.params;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      write(encodeCompanyFinderSseEvent("connected", { jobId }));

      let terminalEventSent = false;

      try {
        const finderService = await createCompanyFinderService();

        for await (const event of finderService.runJob(context, jobId)) {
          pipelineDebug("api.job.stream.event", {
            jobId,
            eventType: event.type,
          });

          if (event.type === "pipeline") {
            write(encodePipelineEvent(event.event));
          }

          if (event.type === "progress") {
            write(encodeProgressEvent({ type: "progress", progress: event.progress }));
          }

          if (event.type === "event") {
            write(
              encodeCompanyFinderSseEvent("event", {
                type: "event",
                eventType: event.eventType,
                payload: event.payload,
              }),
            );
          }

          if (event.type === "candidate") {
            write(
              encodeCandidateEvent(
                toCandidateStreamEvent(
                  event.candidate,
                  event.saved,
                  event.updated,
                  event.skipped,
                ),
              ),
            );
          }

          if (event.type === "complete") {
            write(
              encodeCompleteEvent({
                type: "complete",
                jobId: event.job.id,
                foundCount: event.job.foundCount,
                savedCount: event.job.savedCount,
                updatedCount: event.job.updatedCount,
                skippedCount: event.job.skippedCount,
                errorCount: event.job.errorCount,
                status: event.job.status,
              }),
            );
            terminalEventSent = true;
          }

          if (event.type === "error") {
            write(encodeErrorEvent({ type: "error", message: event.message }));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Zoekjob is mislukt.";
        write(encodeErrorEvent({ type: "error", message }));

        if (!terminalEventSent) {
          write(
            encodeCompleteEvent({
              type: "complete",
              jobId,
              foundCount: 0,
              savedCount: 0,
              updatedCount: 0,
              skippedCount: 0,
              errorCount: 1,
              status: "failed",
            }),
          );
          terminalEventSent = true;
        }
      } finally {
        if (!terminalEventSent) {
          write(encodeErrorEvent({ type: "error", message: "Stream beëindigd zonder resultaat" }));
          write(
            encodeCompleteEvent({
              type: "complete",
              jobId,
              foundCount: 0,
              savedCount: 0,
              updatedCount: 0,
              skippedCount: 0,
              errorCount: 1,
              status: "failed",
            }),
          );
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
      [FINDER_STREAM_FORMAT_HEADER]: FINDER_STREAM_FORMAT_SSE,
    },
  });
}
