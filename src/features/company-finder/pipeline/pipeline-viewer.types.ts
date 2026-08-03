export const PIPELINE_VIEWER_STEP_IDS = [
  "discovery",
  "crawler",
  "vacancies",
  "hiring_signals",
  "ai_analysis",
  "lead_score",
  "saving",
  "ui_update",
] as const;

export type PipelineViewerStepId = (typeof PIPELINE_VIEWER_STEP_IDS)[number];

export type PipelineStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type PipelineStepSnapshot = {
  id: PipelineViewerStepId;
  label: string;
  status: PipelineStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  provider: string | null;
  resultCount: number;
  errorCount: number;
  errors: string[];
  retryCount: number;
  fallbackProvider: string | null;
  message: string | null;
};

export const PIPELINE_STEP_LABELS: Record<PipelineViewerStepId, string> = {
  discovery: "Discovery",
  crawler: "Crawler",
  vacancies: "Vacatures",
  hiring_signals: "Hiring Signals",
  ai_analysis: "AI Analyse",
  lead_score: "Leadscore",
  saving: "Opslaan",
  ui_update: "UI Update",
};

export type PipelineStreamEvent =
  | { type: "snapshot"; jobId: string; steps: PipelineStepSnapshot[]; updatedAt: string }
  | {
      type: "step_started";
      jobId: string;
      stepId: PipelineViewerStepId;
      step: PipelineStepSnapshot;
    }
  | {
      type: "step_updated";
      jobId: string;
      stepId: PipelineViewerStepId;
      step: PipelineStepSnapshot;
    }
  | {
      type: "step_completed";
      jobId: string;
      stepId: PipelineViewerStepId;
      step: PipelineStepSnapshot;
    }
  | {
      type: "step_failed";
      jobId: string;
      stepId: PipelineViewerStepId;
      step: PipelineStepSnapshot;
    };

export function createInitialPipelineSteps(): PipelineStepSnapshot[] {
  return PIPELINE_VIEWER_STEP_IDS.map((id) => ({
    id,
    label: PIPELINE_STEP_LABELS[id],
    status: "pending",
    startedAt: null,
    completedAt: null,
    durationMs: null,
    provider: null,
    resultCount: 0,
    errorCount: 0,
    errors: [],
    retryCount: 0,
    fallbackProvider: null,
    message: null,
  }));
}
