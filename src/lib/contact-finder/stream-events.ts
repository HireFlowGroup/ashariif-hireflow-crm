import type {
  ContactFinderProgress,
  ExternalContactCandidate,
} from "@/features/contact-finder/domain";

export const CONTACT_FINDER_STREAM_FORMAT_HEADER = "X-Contact-Finder-Stream-Format";
export const CONTACT_FINDER_STREAM_FORMAT_NDJSON = "ndjson-v1";

export type ContactFinderStreamProgressEvent = {
  type: "progress";
  progress: ContactFinderProgress;
};

export type ContactFinderStreamCandidateEvent = {
  type: "candidate";
  name: string;
  jobTitle: string | null;
  saved: boolean;
  skipped: boolean;
};

export type ContactFinderStreamCompleteEvent = {
  type: "complete";
  jobId: string;
  foundCount: number;
  savedCount: number;
  skippedCount: number;
  errorCount: number;
};

export type ContactFinderStreamErrorEvent = {
  type: "error";
  message: string;
};

export type ContactFinderStreamEvent =
  | ContactFinderStreamProgressEvent
  | ContactFinderStreamCandidateEvent
  | ContactFinderStreamCompleteEvent
  | ContactFinderStreamErrorEvent;

export function encodeContactFinderStreamEvent(event: ContactFinderStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function toCandidateStreamEvent(
  candidate: ExternalContactCandidate,
  saved: boolean,
  skipped: boolean,
): ContactFinderStreamCandidateEvent {
  return {
    type: "candidate",
    name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle: candidate.jobTitle,
    saved,
    skipped,
  };
}
