"use client";

import { Database, Loader2 } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatStreamToolEvent } from "@/lib/ai/chat/stream-events";

export type CopilotSourceEntry = ChatStreamToolEvent & {
  id: string;
  at: string;
};

type CopilotSourcesPanelProps = {
  events: CopilotSourceEntry[];
  isStreaming?: boolean;
};

const TOOL_LABELS: Record<string, string> = {
  getLeadsToCallToday: "Leads bellen vandaag",
  getWarmingLeads: "Warmer geworden leads",
  getTopGrowingCompanies: "Snel groeiende bedrijven",
  getQuietClients: "Stilgevallen klanten",
  findSimilarCompanies: "Vergelijkbare bedrijven",
  getCompaniesByAts: "ATS-detectie",
  getCompaniesByVacancyRole: "Vacature-rol zoeken",
  getCompaniesWithNewVacancies: "Nieuwe vacatures",
  getCompaniesHiringRecruiters: "Recruiters gezocht",
  searchRecruitmentKnowledge: "RAG kennisbank",
  searchCompanies: "Bedrijven zoeken",
  searchVacancies: "Vacatures zoeken",
};

export function CopilotSourcesPanel({ events, isStreaming = false }: CopilotSourcesPanelProps) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l bg-muted/10 xl:flex">
      <div className="border-b px-3 py-3">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-primary" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Databronnen
            </p>
            <p className="text-xs text-muted-foreground">
              {isStreaming ? "Copilot haalt data op…" : "Onderbouwing via tools & RAG"}
            </p>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {events.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Elke Copilot-antwoord wordt onderbouwd met database-tools. Start een vraag om bronnen
              te zien.
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-xs",
                  event.success
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">
                    {TOOL_LABELS[event.name] ?? event.name}
                  </p>
                  {isStreaming ? (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground">{event.message}</p>
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/80">{event.name}</p>
                <p className="text-[10px] text-muted-foreground">{event.at}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

/** @deprecated Use CopilotSourcesPanel */
export type AiToolDebugEntry = CopilotSourceEntry;
/** @deprecated Use CopilotSourcesPanel */
export const AiToolDebugPanel = CopilotSourcesPanel;
