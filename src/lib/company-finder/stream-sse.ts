import type { PipelineStreamEvent } from "@/features/company-finder/pipeline/pipeline-viewer.types";
import type {
  FinderStreamCandidateEvent,
  FinderStreamCompleteEvent,
  FinderStreamErrorEvent,
  FinderStreamEvent,
  FinderStreamProgressEvent,
} from "@/lib/company-finder/stream-events";

export type CompanyFinderSseEventName =
  | "pipeline"
  | "progress"
  | "candidate"
  | "complete"
  | "error"
  | "connected"
  | "event";

export function encodeCompanyFinderSseEvent(
  event: CompanyFinderSseEventName,
  data: unknown,
): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function encodePipelineEvent(event: PipelineStreamEvent): string {
  return encodeCompanyFinderSseEvent("pipeline", event);
}

export function encodeProgressEvent(event: FinderStreamProgressEvent): string {
  return encodeCompanyFinderSseEvent("progress", event);
}

export function encodeCandidateEvent(event: FinderStreamCandidateEvent): string {
  return encodeCompanyFinderSseEvent("candidate", event);
}

export function encodeCompleteEvent(event: FinderStreamCompleteEvent): string {
  return encodeCompanyFinderSseEvent("complete", event);
}

export function encodeErrorEvent(event: FinderStreamErrorEvent): string {
  return encodeCompanyFinderSseEvent("error", event);
}

/** @deprecated NDJSON — use SSE helpers above */
export function encodeFinderStreamEvent(event: FinderStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export {
  FINDER_STREAM_FORMAT_HEADER,
  FINDER_STREAM_FORMAT_NDJSON,
  FINDER_STREAM_FORMAT_SSE,
  toCandidateStreamEvent,
} from "@/lib/company-finder/stream-events-core";
