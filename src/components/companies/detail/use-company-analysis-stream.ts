"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CompanyAnalysisResponse } from "@/features/company-ai-analysis/domain/analysis.types";

type UseCompanyAnalysisStreamOptions = {
  companyId: string;
  enabled?: boolean;
};

type UseCompanyAnalysisStreamResult = {
  data: CompanyAnalysisResponse | null;
  isConnected: boolean;
  isLoading: boolean;
  isRegenerating: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  regenerate: () => Promise<void>;
};

export function useCompanyAnalysisStream({
  companyId,
  enabled = true,
}: UseCompanyAnalysisStreamOptions): UseCompanyAnalysisStreamResult {
  const [data, setData] = useState<CompanyAnalysisResponse | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/companies/${companyId}/analysis?generateIfMissing=true`,
      );

      if (!response.ok) {
        throw new Error("Analyse laden mislukt");
      }

      const payload = (await response.json()) as CompanyAnalysisResponse;
      setData(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analyse laden mislukt");
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const regenerate = useCallback(async () => {
    setIsRegenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/analysis`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Analyse vernieuwen mislukt");
      }

      const payload = (await response.json()) as CompanyAnalysisResponse;
      setData(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analyse vernieuwen mislukt");
    } finally {
      setIsRegenerating(false);
    }
  }, [companyId]);

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

    const source = new EventSource(`/api/companies/${companyId}/analysis/stream`);
    sourceRef.current = source;

    source.addEventListener("connected", () => {
      setIsConnected(true);
      setErrorMessage(null);
    });

    source.addEventListener("analysis", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as CompanyAnalysisResponse;
        setData(payload);
        setIsLoading(false);
      } catch {
        setErrorMessage("Stream data kon niet worden verwerkt");
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
  }, [companyId, enabled]);

  return {
    data,
    isConnected,
    isLoading,
    isRegenerating,
    errorMessage,
    refresh,
    regenerate,
  };
}
