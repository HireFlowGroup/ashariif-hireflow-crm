import type {
  AiRecruiterPipelineStep,
  AiRecruiterPipelineStepId,
} from "@/features/ai-recruiter/domain/types";

type StepUpdate = Partial<
  Pick<AiRecruiterPipelineStep, "processed" | "succeeded" | "skipped" | "errors" | "message">
>;

export type PipelineEmitter = (steps: AiRecruiterPipelineStep[]) => void;

const PIPELINE_ORDER: AiRecruiterPipelineStepId[] = [
  "discovery",
  "crawler",
  "vacancies",
  "hiring_signals",
  "contact_finder",
  "ai_analysis",
  "lead_score",
  "drafts",
  "approval",
  "sending",
  "follow_up",
];

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

  private getStep(stepId: AiRecruiterPipelineStepId): AiRecruiterPipelineStep {
    const step = this.steps.get(stepId);
    if (!step) throw new Error(`Onbekende pipeline stap: ${stepId}`);
    return step;
  }

  startStep(stepId: AiRecruiterPipelineStepId, update: StepUpdate = {}): void {
    const step = this.getStep(stepId);
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
    const step = this.getStep(stepId);
    Object.assign(step, update);
    this.publish();
  }

  completeStep(stepId: AiRecruiterPipelineStepId, update: StepUpdate = {}): void {
    const step = this.getStep(stepId);
    const start = this.startedAt.get(stepId);
    const now = Date.now();
    step.status = "completed";
    step.completedAt = new Date(now).toISOString();
    step.durationMs = start ? now - start : null;
    Object.assign(step, update);
    this.publish();
  }

  failStep(stepId: AiRecruiterPipelineStepId, message: string, update: StepUpdate = {}): void {
    const step = this.getStep(stepId);
    const start = this.startedAt.get(stepId);
    const now = Date.now();
    step.status = "failed";
    step.completedAt = new Date(now).toISOString();
    step.durationMs = start ? now - start : null;
    step.message = message;
    step.errors += 1;
    Object.assign(step, update);
    this.publish();
  }

  skipStep(stepId: AiRecruiterPipelineStepId, message: string, update: StepUpdate = {}): void {
    const step = this.getStep(stepId);
    if (step.status === "running") {
      const start = this.startedAt.get(stepId);
      const now = Date.now();
      step.completedAt = new Date(now).toISOString();
      step.durationMs = start ? now - start : null;
    }
    step.status = "skipped";
    step.message = message;
    Object.assign(step, update);
    this.publish();
  }

  /** Skip all steps after a given step that are still pending or running. */
  skipDownstreamSteps(afterStepId: AiRecruiterPipelineStepId, message: string): void {
    const index = PIPELINE_ORDER.indexOf(afterStepId);
    if (index === -1) return;

    for (const stepId of PIPELINE_ORDER.slice(index + 1)) {
      const step = this.steps.get(stepId);
      if (!step) continue;
      if (step.status === "pending" || step.status === "running") {
        this.skipStep(stepId, message);
      }
    }
  }

  /** Ensure no pending/running steps remain on a terminal run. */
  finalizeTerminalRun(defaultSkipMessage = "Niet uitgevoerd — run beëindigd"): void {
    for (const stepId of PIPELINE_ORDER) {
      const step = this.steps.get(stepId);
      if (!step) continue;
      if (step.status === "pending" || step.status === "running") {
        this.skipStep(stepId, step.message ?? defaultSkipMessage);
      }
    }
  }

  hasPendingOrRunningSteps(): boolean {
    return [...this.steps.values()].some(
      (step) => step.status === "pending" || step.status === "running",
    );
  }
}
