"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Workflow } from "lucide-react";

import { PipelineColumn } from "@/components/commercial-pipeline/pipeline-column";
import { Button } from "@/components/ui/button";
import type {
  CommercialPipelineBoard,
  CommercialPipelineStage,
} from "@/features/commercial-pipeline/domain/types";
import { cn } from "@/lib/utils";

type CommercialPipelineBoardProps = {
  initialBoard: CommercialPipelineBoard;
};

export function CommercialPipelineBoardView({ initialBoard }: CommercialPipelineBoardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<CommercialPipelineStage | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBoard = useCallback(async () => {
    const response = await fetch("/api/commercial-pipeline");
    if (!response.ok) {
      throw new Error("Kon pipeline niet verversen.");
    }
    return (await response.json()) as CommercialPipelineBoard;
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/commercial-pipeline?action=sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Synchronisatie mislukt.");
      }
      const result = (await response.json()) as { board: CommercialPipelineBoard; imported: number };
      setBoard(result.board);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Synchronisatie mislukt.");
    } finally {
      setSyncing(false);
    }
  };

  const moveCard = async (cardId: string, stage: CommercialPipelineStage) => {
    const card = board.columns.flatMap((col) => col.cards).find((c) => c.id === cardId);
    if (!card || card.stage === stage) return;

    const previousBoard = board;

    setMoving(true);
    setError(null);

    const optimistic: CommercialPipelineBoard = {
      ...board,
      columns: board.columns.map((column) => {
        if (column.stage === card.stage) {
          return {
            ...column,
            count: column.count - 1,
            cards: column.cards.filter((c) => c.id !== cardId),
          };
        }
        if (column.stage === stage) {
          const movedCard = { ...card, stage, movedAt: new Date().toISOString() };
          return {
            ...column,
            count: column.count + 1,
            cards: [...column.cards, movedCard],
          };
        }
        return column;
      }),
      stageCounts: {
        ...board.stageCounts,
        [card.stage]: board.stageCounts[card.stage] - 1,
        [stage]: board.stageCounts[stage] + 1,
      },
    };

    setBoard(optimistic);

    try {
      const response = await fetch(`/api/commercial-pipeline/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Verplaatsen mislukt.");
      }

      const updatedBoard = await refreshBoard();
      setBoard(updatedBoard);
    } catch (moveError) {
      setBoard(previousBoard);
      setError(moveError instanceof Error ? moveError.message : "Verplaatsen mislukt.");
    } finally {
      setMoving(false);
      setDraggingCardId(null);
      setDropTargetStage(null);
    }
  };

  const activeCount = board.totalCards - board.stageCounts.verloren;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Workflow className="size-4" />
            {activeCount} actieve deals
          </span>
          <span>·</span>
          <span>{board.totalCards} totaal</span>
          {moving ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <Loader2 className="size-3 animate-spin" />
              Opslaan…
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Importeer bedrijven
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/companies">Bedrijven bekijken</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {board.totalCards === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <Workflow className="mb-3 size-10 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">Commerciële pipeline is leeg</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            HireFlow is een AI Business Development platform. Importeer bedrijven uit je workspace om
            deals te tracken van eerste contact tot plaatsing.
          </p>
          <Button className="mt-4" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Start met bedrijven importeren
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-3">
            {board.columns.map((column) => (
              <PipelineColumn
                key={column.stage}
                column={column}
                draggingCardId={draggingCardId}
                dropTargetStage={dropTargetStage}
                onDragStart={setDraggingCardId}
                onDragEnd={() => {
                  setDraggingCardId(null);
                  setDropTargetStage(null);
                }}
                onDragOver={setDropTargetStage}
                onDragLeave={() => setDropTargetStage(null)}
                onDrop={(stage) => {
                  if (draggingCardId) {
                    void moveCard(draggingCardId, stage);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type CommercialPipelineCountsStripProps = {
  board: CommercialPipelineBoard;
  className?: string;
};

export function CommercialPipelineCountsStrip({
  board,
  className,
}: CommercialPipelineCountsStripProps) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7", className)}>
      {board.columns.map((column) => (
        <div
          key={column.stage}
          className="rounded-lg border bg-card px-3 py-2"
        >
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {column.label}
          </p>
          <p className="text-xl font-semibold tabular-nums">{column.count}</p>
        </div>
      ))}
    </div>
  );
}
