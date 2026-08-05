import type { AiRecruiterStreamEvent } from "@/features/ai-recruiter/domain/types";

export const RECRUITER_STREAM_FORMAT_HEADER = "X-Ai-Recruiter-Stream-Format";
export const RECRUITER_STREAM_FORMAT_SSE = "sse-v1";

export function encodeRecruiterSseEvent(
  event: string,
  data: Record<string, unknown>,
): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function encodeRecruiterStreamEvent(event: AiRecruiterStreamEvent): string {
  switch (event.type) {
    case "connected":
      return encodeRecruiterSseEvent("connected", { runId: event.runId });
    case "run_status":
      return encodeRecruiterSseEvent("run_status", { status: event.status, message: event.message });
    case "pipeline":
      return encodeRecruiterSseEvent("pipeline", { steps: event.steps });
    case "item":
      return encodeRecruiterSseEvent("item", { item: event.item });
    case "counters":
      return encodeRecruiterSseEvent("counters", { counters: event.counters });
    case "complete":
      return encodeRecruiterSseEvent("complete", { run: event.run });
    case "error":
      return encodeRecruiterSseEvent("error", { message: event.message, diagnostics: event.diagnostics ?? null });
    default:
      return encodeRecruiterSseEvent("unknown", {});
  }
}
