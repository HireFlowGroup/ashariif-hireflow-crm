import type {
  AiRecruiterPipelineStep,
  AiRecruiterPipelineStepId,
} from "@/features/ai-recruiter/domain/types";

type StepUpdate = Partial<
  Pick<AiRecruiterPipelineStep, "processed" | "succeeded" | "skipped" | "errors" | "message">
>;

export type PipelineEmitter = (steps: AiRecruiterPipelineStep[]) => void;

export class RecruiterPipelineTracker {
  private readonly steps: Map<AiRecruiterPipelineStepId, AiRecruiterPipelineStep>;
  private readonly startedAt = new Map<AiRecruiterPipelineStepId, number>();

  constructor(
    initialSteps: AiRecruiterPipelineStep[],
    private readonly emit: PipelineEmitter,
  ) {
    this.steps = new Map(initialSteps.map((s) => [s.id, { ...s }]));
  }

  getSnapshot(): AiRecruiterPipelineStep[] {
    return [...this.steps.values()];
  }

  private publish(): void {
    this.emit(this.getSnapshot());
  }

  startStep(stepId: AiRecruiterPipelineStepId, update: StepUpdate = {}): void {
    const step = this.steps.get(stepId)!;
    const now = Date.now();
    step.status = "running";
    step.startedAt = new Date(now).toISOString();
    step.completedAt = null;
    step.durationMs = null;
    Object.assign(step, update);
    this.startedAt.set(stepId, now);
    this.publish();
  }

  updateStep(stepId: AiRecruiterPipelineStepId, update: StepUpdate): void {
    const step = this.steps.get(stepId)!;
    Object.assign(step, update);
    this.publish();
  }

  completeStep(stepId: AiRecruiterPipelineStepId, update: StepUpdate = {}): void {
    const step = this.steps.get(stepId)!;
    const start = this.startedAt.get(stepId);
    const now = Date.now();
    step.status = "completed";
    step.completedAt = new Date(now).toISOString();
    step.durationMs = start ? now - start : null;
    Object.assign(step, update);
    this.publish();
  }

  failStep(stepId: AiRecruiterPipelineStepId, message: string): void {
    const step = this.steps.get(stepId)!;
    const start = this.startedAt.get(stepId);
    const now = Date.now();
    step.status = "failed";
    step.completedAt = new Date(now).toISOString();
    step.durationMs = start ? now - start : null;
    step.message = message;
    step.errors += 1;
    this.publish();
  }

  skipStep(stepId: AiRecruiterPipelineStepId, message: string): void {
    const step = this.steps.get(stepId)!;
    step.status = "skipped";
    step.message = message;
    this.publish();
  }
}
