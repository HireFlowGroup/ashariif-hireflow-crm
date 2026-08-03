"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CompanySearchPipelineTimeline,
  createInitialPipelineSteps,
} from "@/components/companies/company-search-pipeline-timeline";
import type { CompanyFinderProgress } from "@/features/company-finder/domain";
import type { PipelineStepSnapshot } from "@/features/company-finder/pipeline/pipeline-viewer.types";
import type { PipelineStreamEvent } from "@/features/company-finder/pipeline/pipeline-viewer.types";
import type {
  FinderStreamCandidateEvent,
  FinderStreamCompleteEvent,
} from "@/lib/company-finder/stream-events-core";

type RecentCandidate = FinderStreamCandidateEvent;

type UseCompanySearchStreamOptions = {
  jobId: string | null;
  enabled: boolean;
  onCompleted?: (summary: FinderStreamCompleteEvent) => void;
  onEnrichmentPartial?: (message: string) => void;
};

type UseCompanySearchStreamResult = {
  steps: PipelineStepSnapshot[];
  progress: CompanyFinderProgress | null;
  recentCandidates: RecentCandidate[];
  errorMessage: string | null;
  isConnected: boolean;
  isComplete: boolean;
  cancel: () => void;
};

function applyPipelineEvent(
  steps: PipelineStepSnapshot[],
  event: PipelineStreamEvent,
): PipelineStepSnapshot[] {
  if (event.type === "snapshot") {
    return event.steps;
  }

  return steps.map((step) => (step.id === event.stepId ? event.step : step));
}

export function useCompanySearchStream({
  jobId,
  enabled,
  onCompleted,
  onEnrichmentPartial,
}: UseCompanySearchStreamOptions): UseCompanySearchStreamResult {
  const [steps, setSteps] = useState<PipelineStepSnapshot[]>(createInitialPipelineSteps());
  const [progress, setProgress] = useState<CompanyFinderProgress | null>(null);
  const [recentCandidates, setRecentCandidates] = useState<RecentCandidate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const onCompletedRef = useRef(onCompleted);
  const onEnrichmentPartialRef = useRef(onEnrichmentPartial);

  onCompletedRef.current = onCompleted;
  onEnrichmentPartialRef.current = onEnrichmentPartial;

  const cancel = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || !jobId) {
      cancel();
      return;
    }

    setSteps(createInitialPipelineSteps());
    setProgress(null);
    setRecentCandidates([]);
    setErrorMessage(null);
    setIsComplete(false);
    setIsConnected(false);

    const source = new EventSource(`/api/company-finder/jobs/${jobId}/stream`);
    sourceRef.current = source;

    source.addEventListener("connected", () => setIsConnected(true));

    source.addEventListener("pipeline", (raw) => {
      try {
        const event = JSON.parse(raw.data) as PipelineStreamEvent;
        setSteps((current) => applyPipelineEvent(current, event));
      } catch {
        // ignore malformed events
      }
    });

    source.addEventListener("progress", (raw) => {
      try {
        const payload = JSON.parse(raw.data) as { progress: CompanyFinderProgress };
        setProgress(payload.progress);
      } catch {
        // ignore
      }
    });

    source.addEventListener("candidate", (raw) => {
      try {
        const candidate = JSON.parse(raw.data) as RecentCandidate;
        setRecentCandidates((current) => [candidate, ...current].slice(0, 10));
      } catch {
        // ignore
      }
    });

    source.addEventListener("event", (raw) => {
      try {
        const payload = JSON.parse(raw.data) as {
          eventType?: string;
          payload?: { message?: string };
        };
        if (payload.eventType === "enrichment_partial" && payload.payload?.message) {
          onEnrichmentPartialRef.current?.(payload.payload.message);
        }
        if (payload.eventType === "save_failed" && payload.payload?.message) {
          setErrorMessage(payload.payload.message);
        }
      } catch {
        // ignore malformed events
      }
    });

    source.addEventListener("complete", (raw) => {
      try {
        const payload = JSON.parse(raw.data) as FinderStreamCompleteEvent;
        setIsComplete(true);
        onCompletedRef.current?.(payload);
      } catch {
        // ignore
      } finally {
        source.close();
      }
    });

    source.addEventListener("error", (raw) => {
      if (raw instanceof MessageEvent && raw.data) {
        try {
          const payload = JSON.parse(raw.data) as { message: string };
          setErrorMessage(payload.message);
        } catch {
          setErrorMessage("Stream onderbroken");
        }
      } else {
        setIsConnected(false);
      }
    });

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [enabled, jobId, cancel]);

  return {
    steps,
    progress,
    recentCandidates,
    errorMessage,
    isConnected,
    isComplete,
    cancel,
  };
}

export { CompanySearchPipelineTimeline };
