"use client";

import Link from "next/link";
import { Building2, GripVertical, Mail, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CommercialPipelineCard } from "@/features/commercial-pipeline/domain/types";
import { priorityColorClass } from "@/features/lead-scoring/domain/lead-score.types";
import { cn } from "@/lib/utils";

type PipelineCardProps = {
  card: CommercialPipelineCard;
  isDragging?: boolean;
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
};

function scoreToPriority(score: number | null): "A" | "B" | "C" | "D" | null {
  if (score === null) return null;
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

export function PipelineCard({
  card,
  isDragging,
  onDragStart,
  onDragEnd,
}: PipelineCardProps) {
  const priority = scoreToPriority(card.leadScore);

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
        onDragStart(card.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing",
        "hover:border-primary/30 hover:shadow-md",
        isDragging && "opacity-50 ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/companies/${card.companyId}`}
              className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {card.companyName}
            </Link>
            {priority ? (
              <span className={cn("shrink-0 text-xs font-semibold", priorityColorClass(priority))}>
                {priority}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {card.sector ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                {card.sector}
              </Badge>
            ) : null}
            {card.city ? (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" />
                {card.city}
              </span>
            ) : null}
          </div>

          {card.contactName || card.contactEmail ? (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {card.contactName ? (
                <p className="inline-flex items-center gap-1 truncate">
                  <Building2 className="size-3 shrink-0" />
                  {card.contactName}
                </p>
              ) : null}
              {card.contactEmail ? (
                <p className="inline-flex items-center gap-1 truncate">
                  <Mail className="size-3 shrink-0" />
                  {card.contactEmail}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
