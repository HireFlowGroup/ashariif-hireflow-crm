"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatStreamToolEvent } from "@/lib/ai/chat/stream-events";

export type AiToolDebugEntry = ChatStreamToolEvent & {
  id: string;
  at: string;
};

type AiToolDebugPanelProps = {
  events: AiToolDebugEntry[];
  isStreaming?: boolean;
};

export function AiToolDebugPanel({ events, isStreaming = false }: AiToolDebugPanelProps) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l bg-muted/10 lg:flex">
      <div className="border-b px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tool-events
        </p>
        <p className="text-xs text-muted-foreground">
          {isStreaming ? "Assistent is bezig…" : "Debug van CRM-toolcalls"}
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {events.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Nog geen tools uitgevoerd in dit gesprek.
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={cn(
                  "rounded-md border px-2 py-2 text-xs",
                  event.success
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <p className="font-mono font-medium">{event.name}</p>
                <p className="mt-1 text-muted-foreground">{event.message}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{event.at}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
