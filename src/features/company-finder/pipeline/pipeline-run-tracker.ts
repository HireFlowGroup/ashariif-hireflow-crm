import {
  createInitialPipelineSteps,
  type PipelineStepSnapshot,
  type PipelineStreamEvent,
  type PipelineStepStatus,
  type PipelineViewerStepId,
} from "@/features/company-finder/pipeline/pipeline-viewer.types";

type StepUpdate = Partial<
  Pick<
    PipelineStepSnapshot,
    | "provider"
    | "resultCount"
    | "errorCount"
    | "errors"
    | "retryCount"
    | "fallbackProvider"
    | "message"
  >
>;

export type PipelineEventEmitter = (event: PipelineStreamEvent) => void;

export class PipelineRunTracker {
  private readonly steps: Map<PipelineViewerStepId, PipelineStepSnapshot>;
  private readonly startedAt = new Map<PipelineViewerStepId, number>();

  constructor(
    private readonly jobId: string,
    private readonly emit: PipelineEventEmitter,
  ) {
    this.steps = new Map(
      createInitialPipelineSteps().map((step) => [step.id, { ...step }]),
    );
  }

  getSnapshot(): PipelineStepSnapshot[] {
    return PIPELINE_VIEWER_STEP_IDS.map((id) => ({ ...this.steps.get(id)! }));
  }

  private publish(
    type: PipelineStreamEvent["type"],
    stepId: PipelineViewerStepId,
  ): void {
    const step = { ...this.steps.get(stepId)! };

    if (type === "snapshot") {
      this.emit({
        type: "snapshot",
        jobId: this.jobId,
        steps: this.getSnapshot(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    this.emit({
      type,
      jobId: this.jobId,
      stepId,
      step,
    } as PipelineStreamEvent);

    this.emit({
      type: "snapshot",
      jobId: this.jobId,
      steps: this.getSnapshot(),
      updatedAt: new Date().toISOString(),
    });
  }

  startStep(stepId: PipelineViewerStepId, update: StepUpdate = {}): void {
    const step = this.steps.get(stepId)!;
    const now = Date.now();

    step.status = "running";
    step.startedAt = new Date(now).toISOString();
    step.completedAt = null;
    step.durationMs = null;
    this.startedAt.set(stepId, now);
    this.applyUpdate(step, update);

    this.publish("step_started", stepId);
  }

  updateStep(stepId: PipelineViewerStepId, update: StepUpdate): void {
    const step = this.steps.get(stepId)!;
    this.applyUpdate(step, update);

    if (step.status === "pending") {
      step.status = "running";
    }

    if (step.startedAt) {
      step.durationMs = Date.now() - new Date(step.startedAt).getTime();
    }

    this.publish("step_updated", stepId);
  }

  completeStep(stepId: PipelineViewerStepId, update: StepUpdate = {}): void {
    const step = this.steps.get(stepId)!;
    const started = this.startedAt.get(stepId);
    const now = Date.now();

    step.status = update.errorCount && update.errorCount > 0 && !update.resultCount ? "failed" : "completed";
    step.completedAt = new Date(now).toISOString();
    step.durationMs = started ? now - started : step.durationMs;
    this.applyUpdate(step, update);

    this.publish(step.status === "failed" ? "step_failed" : "step_completed", stepId);
  }

  failStep(stepId: PipelineViewerStepId, error: string, update: StepUpdate = {}): void {
    const step = this.steps.get(stepId)!;
    const started = this.startedAt.get(stepId);
    const now = Date.now();

    step.status = "failed";
    step.completedAt = new Date(now).toISOString();
    step.durationMs = started ? now - started : step.durationMs;
    step.errorCount = Math.max(step.errorCount, 1);
    step.errors = [...step.errors, error];
    this.applyUpdate(step, update);

    this.publish("step_failed", stepId);
  }

  skipStep(stepId: PipelineViewerStepId, message?: string): void {
    const step = this.steps.get(stepId)!;
    step.status = "skipped";
    step.message = message ?? "Overgeslagen";
    step.completedAt = new Date().toISOString();
    this.publish("step_completed", stepId);
  }

  private applyUpdate(step: PipelineStepSnapshot, update: StepUpdate): void {
    if (update.provider !== undefined) step.provider = update.provider;
    if (update.resultCount !== undefined) step.resultCount = update.resultCount;
    if (update.errorCount !== undefined) step.errorCount = update.errorCount;
    if (update.errors !== undefined) step.errors = update.errors;
    if (update.retryCount !== undefined) step.retryCount = update.retryCount;
    if (update.fallbackProvider !== undefined) step.fallbackProvider = update.fallbackProvider;
    if (update.message !== undefined) step.message = update.message;
  }
}

// Re-export for convenience
import { PIPELINE_VIEWER_STEP_IDS } from "@/features/company-finder/pipeline/pipeline-viewer.types";
export { PIPELINE_VIEWER_STEP_IDS };
