import { createContactFinderService } from "@/features/contact-finder/create-contact-finder-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import {
  CONTACT_FINDER_STREAM_FORMAT_HEADER,
  CONTACT_FINDER_STREAM_FORMAT_NDJSON,
  encodeContactFinderStreamEvent,
  toCandidateStreamEvent,
} from "@/lib/contact-finder/stream-events";

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

      const write = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      try {
        const finderService = await createContactFinderService();

        for await (const event of finderService.runJob(context, jobId)) {
          if (event.type === "progress") {
            write(
              encodeContactFinderStreamEvent({
                type: "progress",
                progress: event.progress,
              }),
            );
          }

          if (event.type === "candidate") {
            write(
              encodeContactFinderStreamEvent(
                toCandidateStreamEvent(event.candidate, event.saved, event.skipped),
              ),
            );
          }

          if (event.type === "complete") {
            write(
              encodeContactFinderStreamEvent({
                type: "complete",
                jobId: event.job.id,
                foundCount: event.job.foundCount,
                savedCount: event.job.savedCount,
                skippedCount: event.job.skippedCount,
                errorCount: event.job.errorCount,
              }),
            );
          }

          if (event.type === "error") {
            write(
              encodeContactFinderStreamEvent({
                type: "error",
                message: event.message,
              }),
            );
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Contactzoeker is mislukt.";

        write(
          encodeContactFinderStreamEvent({
            type: "error",
            message,
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      [CONTACT_FINDER_STREAM_FORMAT_HEADER]: CONTACT_FINDER_STREAM_FORMAT_NDJSON,
    },
  });
}
