"use client";

import { PipelineCard } from "@/components/commercial-pipeline/pipeline-card";
import {
  PIPELINE_STAGE_ACCENT,
  PIPELINE_STAGE_HEADER,
} from "@/components/commercial-pipeline/pipeline-stage-colors";
import { Badge } from "@/components/ui/badge";
import type {
  CommercialPipelineColumn,
  CommercialPipelineStage,
} from "@/features/commercial-pipeline/domain/types";
import { cn } from "@/lib/utils";

type PipelineColumnProps = {
  column: CommercialPipelineColumn;
  draggingCardId: string | null;
  dropTargetStage: CommercialPipelineStage | null;
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
  onDragOver: (stage: CommercialPipelineStage) => void;
  onDragLeave: () => void;
  onDrop: (stage: CommercialPipelineStage) => void;
};

export function PipelineColumn({
  column,
  draggingCardId,
  dropTargetStage,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: PipelineColumnProps) {
  const isDropTarget = dropTargetStage === column.stage;

  return (
    <section
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-xl border border-border/60",
        PIPELINE_STAGE_ACCENT[column.stage],
        isDropTarget && "ring-2 ring-primary/50",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver(column.stage);
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(column.stage);
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5">
        <h2
          className={cn(
            "truncate text-xs font-semibold uppercase tracking-wide",
            PIPELINE_STAGE_HEADER[column.stage],
          )}
        >
          {column.label}
        </h2>
        <Badge variant="outline" className="h-5 min-w-5 justify-center px-1.5 tabular-nums">
          {column.count}
        </Badge>
      </header>

      <div className="flex max-h-[calc(100vh-16rem)] flex-col gap-2 overflow-y-auto p-2">
        {column.cards.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
            Sleep kaarten hierheen
          </p>
        ) : (
          column.cards.map((card) => (
            <PipelineCard
              key={card.id}
              card={card}
              isDragging={draggingCardId === card.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </section>
  );
}
