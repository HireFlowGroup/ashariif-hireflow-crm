import type { CompanyFinderProgress, ExternalCompanyCandidate } from "@/features/company-finder/domain";

export const FINDER_STREAM_FORMAT_HEADER = "X-Company-Finder-Stream-Format";
export const FINDER_STREAM_FORMAT_SSE = "sse-v1";
/** @deprecated */
export const FINDER_STREAM_FORMAT_NDJSON = "ndjson-v2";

export type FinderStreamProgressEvent = {
  type: "progress";
  progress: CompanyFinderProgress;
};

export type FinderStreamEventEvent = {
  type: "event";
  eventType: string;
  payload: Record<string, unknown>;
};

export type FinderStreamCandidateEvent = {
  type: "candidate";
  name: string;
  city: string | null;
  saved: boolean;
  updated: boolean;
  skipped: boolean;
  leadScore?: number | null;
  leadPriority?: "A" | "B" | "C" | "D" | null;
  vacancyCount?: number;
};

export type FinderStreamCompleteEvent = {
  type: "complete";
  jobId: string;
  foundCount: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  status: string;
};

export type FinderStreamErrorEvent = {
  type: "error";
  message: string;
};

export type FinderStreamEvent =
  | FinderStreamProgressEvent
  | FinderStreamEventEvent
  | FinderStreamCandidateEvent
  | FinderStreamCompleteEvent
  | FinderStreamErrorEvent;

export function toCandidateStreamEvent(
  candidate: ExternalCompanyCandidate,
  saved: boolean,
  updated: boolean,
  skipped: boolean,
): FinderStreamCandidateEvent {
  return {
    type: "candidate",
    name: candidate.name,
    city: candidate.city,
    saved,
    updated,
    skipped,
    leadScore: candidate.leadScore,
    leadPriority: candidate.leadPriority,
    vacancyCount: candidate.vacancyCount,
  };
}
