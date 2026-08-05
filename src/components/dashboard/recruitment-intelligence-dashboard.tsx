"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Radio } from "lucide-react";

import { BdDashboardCharts } from "@/components/dashboard/bd-dashboard-charts";
import { BdTodayKpiStrip } from "@/components/dashboard/bd-today-kpi-strip";
import { DashboardFiltersBar } from "@/components/dashboard/dashboard-filters";
import {
  AiRecommendationsWidget,
  HiringSignalsWidget,
  LeadPriorityWidget,
  NewCompaniesWidget,
  PipelineHealthWidget,
  RecruitersWidget,
  TodaysIntelligenceWidget,
  VacanciesWidget,
  WarmLeadsWidget,
} from "@/components/dashboard/dashboard-widgets";
import { CommercialPipelineDashboardWidget } from "@/components/commercial-pipeline/commercial-pipeline-dashboard-widget";
import type { CommercialPipelineBoard } from "@/features/commercial-pipeline/domain/types";
import type { DashboardSnapshot } from "@/features/dashboard/domain/dashboard.types";
import type { DashboardStreamEvent } from "@/lib/dashboard/stream-events";
import { cn } from "@/lib/utils";

type RecruitmentIntelligenceDashboardProps = {
  initialSnapshot: DashboardSnapshot;
  sectors: string[];
  commercialPipelineBoard: CommercialPipelineBoard;
};

function buildStreamUrl(filters: DashboardSnapshot["filters"]): string {
  const params = new URLSearchParams();
  params.set("period", filters.period);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.sector) params.set("sector", filters.sector);
  return `/api/dashboard/stream?${params.toString()}`;
}

export function RecruitmentIntelligenceDashboard({
  initialSnapshot,
  sectors,
  commercialPipelineBoard,
}: RecruitmentIntelligenceDashboardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [live, setLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(initialSnapshot.generatedAt);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const connectStream = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(buildStreamUrl(snapshot.filters), {
        signal: controller.signal,
        headers: { Accept: "application/x-ndjson" },
      });

      if (!response.ok || !response.body) {
        setLive(false);
        setStreamError("Live stream niet beschikbaar.");
        return;
      }

      setLive(true);
      setStreamError(null);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as DashboardStreamEvent;
            if (event.type === "snapshot") {
              setSnapshot(event.snapshot);
              setLastUpdate(event.snapshot.generatedAt);
            } else if (event.type === "error") {
              setStreamError(event.message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      setLive(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLive(false);
      setStreamError(error instanceof Error ? error.message : "Stream onderbroken");
    }
  }, [snapshot.filters]);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    setLastUpdate(initialSnapshot.generatedAt);
  }, [initialSnapshot]);

  useEffect(() => {
    void connectStream();
    return () => abortRef.current?.abort();
  }, [connectStream]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardFiltersBar filters={snapshot.filters} sectors={sectors} />
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
            live ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {live ? <Radio className="size-3 animate-pulse" /> : <Loader2 className="size-3" />}
          <span>{live ? "Live" : "Offline"}</span>
          <span className="text-muted-foreground">· {new Date(lastUpdate).toLocaleTimeString("nl-NL")}</span>
        </div>
      </div>

      {streamError ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          {streamError} — toont laatst geladen data.
        </p>
      ) : null}

      <BdTodayKpiStrip today={snapshot.bdMetrics.today} />

      <BdDashboardCharts trends={snapshot.bdMetrics.trends} />

      <details className="rounded-xl border bg-card/50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
          Recruitment intelligence (signals, leads, aanbevelingen)
        </summary>
        <div className="space-y-6 border-t px-4 py-4">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <HiringSignalsWidget signals={snapshot.recentSignals} trend={snapshot.signalTrend} />
            <VacanciesWidget vacancies={snapshot.recentVacancies} />
            <NewCompaniesWidget count={snapshot.kpis.newCompanies} leads={snapshot.warmLeads} />
            <RecruitersWidget recruiters={snapshot.recruiterSignals} />
            <TodaysIntelligenceWidget data={snapshot.todaysIntelligence} />
            <LeadPriorityWidget distribution={snapshot.priorityDistribution} />
          </div>

          <WarmLeadsWidget leads={snapshot.warmLeads} />

          <PipelineHealthWidget
            pipelineStages={snapshot.pipelineStages}
            outreachDistribution={snapshot.outreachDistribution}
          />

          <AiRecommendationsWidget recommendations={snapshot.aiRecommendations} />
        </div>
      </details>

      <CommercialPipelineDashboardWidget board={commercialPipelineBoard} />
    </div>
  );
}
