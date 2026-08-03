export type PipelineStepTiming = {
  step: string;
  provider?: string | null;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  status: "running" | "completed" | "failed" | "skipped" | "timeout";
  resultCount?: number;
  errorMessage?: string | null;
};

export class PipelineStepTimer {
  private readonly steps = new Map<string, PipelineStepTiming>();

  constructor(private readonly jobId: string) {}

  start(step: string, provider?: string | null): void {
    this.steps.set(step, {
      step,
      provider: provider ?? null,
      startedAt: new Date().toISOString(),
      status: "running",
    });
  }

  complete(step: string, input: { resultCount?: number; provider?: string | null } = {}): PipelineStepTiming {
    const existing = this.steps.get(step);
    const completedAt = new Date().toISOString();
    const startedAt = existing?.startedAt ?? completedAt;
    const durationMs = Date.parse(completedAt) - Date.parse(startedAt);

    const record: PipelineStepTiming = {
      step,
      provider: input.provider ?? existing?.provider ?? null,
      startedAt,
      completedAt,
      durationMs,
      status: "completed",
      resultCount: input.resultCount,
      errorMessage: null,
    };

    this.steps.set(step, record);
    return record;
  }

  fail(step: string, errorMessage: string, input: { provider?: string | null; resultCount?: number } = {}): PipelineStepTiming {
    const existing = this.steps.get(step);
    const completedAt = new Date().toISOString();
    const startedAt = existing?.startedAt ?? completedAt;
    const durationMs = Date.parse(completedAt) - Date.parse(startedAt);

    const record: PipelineStepTiming = {
      step,
      provider: input.provider ?? existing?.provider ?? null,
      startedAt,
      completedAt,
      durationMs,
      status: "failed",
      resultCount: input.resultCount ?? 0,
      errorMessage,
    };

    this.steps.set(step, record);
    return record;
  }

  timeout(step: string, errorMessage: string): PipelineStepTiming {
    return this.fail(step, errorMessage, { resultCount: 0 });
  }

  getSteps(): PipelineStepTiming[] {
    return [...this.steps.values()];
  }

  getSlowestStep(): PipelineStepTiming | null {
    const completed = this.getSteps().filter((step) => step.durationMs !== undefined);
    if (completed.length === 0) return null;
    return completed.reduce((slowest, current) =>
      (current.durationMs ?? 0) > (slowest.durationMs ?? 0) ? current : slowest,
    );
  }

  logSummary(): void {
    const steps = this.getSteps();
    const slowest = this.getSlowestStep();
    const totalMs = steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);

    console.info("[CompanyFinderPipeline]", {
      jobId: this.jobId,
      totalDurationMs: totalMs,
      slowestStep: slowest?.step ?? null,
      slowestDurationMs: slowest?.durationMs ?? null,
      steps,
    });
  }
}

export class JobDeadline {
  constructor(private readonly deadlineAt: number) {}

  static fromTimeoutMs(timeoutMs: number): JobDeadline {
    return new JobDeadline(Date.now() + timeoutMs);
  }

  remainingMs(): number {
    return Math.max(0, this.deadlineAt - Date.now());
  }

  assert(phase: string): void {
    if (Date.now() > this.deadlineAt) {
      throw new JobTimeoutError(phase, this.deadlineAt);
    }
  }

  isExpired(): boolean {
    return Date.now() > this.deadlineAt;
  }
}

export class JobTimeoutError extends Error {
  constructor(
    readonly phase: string,
    readonly deadlineAt: number,
  ) {
    super(`Job time-out tijdens fase "${phase}"`);
    this.name = "JobTimeoutError";
  }
}
