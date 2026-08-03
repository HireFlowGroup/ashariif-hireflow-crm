"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  SkipForward,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PipelineStepSnapshot } from "@/features/company-finder/pipeline/pipeline-viewer.types";
import { PIPELINE_VIEWER_STEP_IDS } from "@/features/company-finder/pipeline/pipeline-viewer.types";

type CompanySearchPipelineTimelineProps = {
  steps: PipelineStepSnapshot[];
  className?: string;
};

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function StepIcon({ status }: { status: PipelineStepSnapshot["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="size-4 animate-spin text-primary" />;
    case "completed":
      return <CheckCircle2 className="size-4 text-emerald-500" />;
    case "failed":
      return <AlertCircle className="size-4 text-destructive" />;
    case "skipped":
      return <SkipForward className="size-4 text-muted-foreground" />;
    default:
      return <Circle className="size-4 text-muted-foreground/40" />;
  }
}

function statusLabel(status: PipelineStepSnapshot["status"]): string {
  switch (status) {
    case "running":
      return "Bezig";
    case "completed":
      return "Voltooid";
    case "failed":
      return "Mislukt";
    case "skipped":
      return "Overgeslagen";
    default:
      return "Wachtend";
  }
}

export function CompanySearchPipelineTimeline({
  steps,
  className,
}: CompanySearchPipelineTimelineProps) {
  const ordered = PIPELINE_VIEWER_STEP_IDS.map(
    (id) => steps.find((step) => step.id === id)!,
  ).filter(Boolean);

  return (
    <div className={cn("space-y-1", className)}>
      <p className="mb-3 text-sm font-medium">Pipeline</p>
      <ol className="relative space-y-0">
        {ordered.map((step, index) => {
          const isLast = index === ordered.length - 1;

          return (
            <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  className={cn(
                    "absolute left-[7px] top-5 h-[calc(100%-8px)] w-px",
                    step.status === "completed" ? "bg-emerald-500/40" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}

              <div className="relative z-10 mt-0.5 shrink-0">
                <StepIcon status={step.status} />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{step.label}</span>
                  <Badge
                    variant={
                      step.status === "failed"
                        ? "destructive"
                        : step.status === "running"
                          ? "default"
                          : "outline"
                    }
                    className="text-[10px]"
                  >
                    {statusLabel(step.status)}
                  </Badge>
                  {step.durationMs !== null && step.status !== "pending" ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatDuration(step.durationMs)}
                    </span>
                  ) : null}
                </div>

                {step.message ? (
                  <p className="text-xs text-muted-foreground">{step.message}</p>
                ) : null}

                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {step.provider ? (
                    <span>
                      Provider: <span className="text-foreground">{step.provider}</span>
                    </span>
                  ) : null}
                  {step.resultCount > 0 ? (
                    <span>
                      Resultaten: <span className="text-foreground">{step.resultCount}</span>
                    </span>
                  ) : null}
                  {step.retryCount > 0 ? (
                    <span>
                      Retries: <span className="text-foreground">{step.retryCount}</span>
                    </span>
                  ) : null}
                  {step.fallbackProvider ? (
                    <span>
                      Fallback: <span className="text-foreground">{step.fallbackProvider}</span>
                    </span>
                  ) : null}
                </div>

                {step.errors.length > 0 ? (
                  <ul className="space-y-0.5 text-xs text-destructive">
                    {step.errors.slice(0, 3).map((error) => (
                      <li key={error} className="truncate" title={error}>
                        {error}
                      </li>
                    ))}
                    {step.errors.length > 3 ? (
                      <li>+{step.errors.length - 3} extra fouten</li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export { createInitialPipelineSteps } from "@/features/company-finder/pipeline/pipeline-viewer.types";
