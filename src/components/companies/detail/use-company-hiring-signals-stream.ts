"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  HiringSignalsTimelineResponse,
  TimelineFilterId,
} from "@/features/hiring-signals-timeline/domain/timeline.types";

type UseCompanyHiringSignalsStreamOptions = {
  companyId: string;
  filter: TimelineFilterId;
  enabled?: boolean;
  onTimeline?: (timeline: HiringSignalsTimelineResponse) => void;
};

type UseCompanyHiringSignalsStreamResult = {
  timeline: HiringSignalsTimelineResponse | null;
  isConnected: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  lastUpdatedAt: string | null;
  refresh: () => Promise<void>;
};

export function useCompanyHiringSignalsStream({
  companyId,
  filter,
  enabled = true,
  onTimeline,
}: UseCompanyHiringSignalsStreamOptions): UseCompanyHiringSignalsStreamResult {
  const [timeline, setTimeline] = useState<HiringSignalsTimelineResponse | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const onTimelineRef = useRef(onTimeline);

  onTimelineRef.current = onTimeline;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/companies/${companyId}/hiring-signals/timeline?filter=${filter}`,
      );

      if (!response.ok) {
        throw new Error("Timeline laden mislukt");
      }

      const payload = (await response.json()) as HiringSignalsTimelineResponse;
      setTimeline(payload);
      setLastUpdatedAt(payload.generatedAt);
      onTimelineRef.current?.(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Timeline laden mislukt");
    } finally {
      setIsLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) {
      sourceRef.current?.close();
      sourceRef.current = null;
      setIsConnected(false);
      return;
    }

    const source = new EventSource(
      `/api/companies/${companyId}/hiring-signals/stream?filter=${filter}`,
    );
    sourceRef.current = source;

    source.addEventListener("connected", () => {
      setIsConnected(true);
      setErrorMessage(null);
    });

    source.addEventListener("timeline", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as HiringSignalsTimelineResponse;
        setTimeline(payload);
        setLastUpdatedAt(payload.generatedAt);
        setIsLoading(false);
        onTimelineRef.current?.(payload);
      } catch {
        setErrorMessage("Stream data kon niet worden verwerkt");
      }
    });

    source.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && event.data) {
        try {
          const payload = JSON.parse(event.data) as { message?: string };
          if (payload.message) {
            setErrorMessage(payload.message);
          }
        } catch {
          // ignore malformed error payloads
        }
      }
    });

    source.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      source.close();
      sourceRef.current = null;
      setIsConnected(false);
    };
  }, [companyId, filter, enabled]);

  return {
    timeline,
    isConnected,
    isLoading,
    errorMessage,
    lastUpdatedAt,
    refresh,
  };
}
