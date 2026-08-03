import { randomUUID } from "crypto";

import type {
  PipelineRunDiagnostic,
  PipelineStepDiagnostic,
  PipelineStepName,
} from "@/features/lead-intelligence/providers/manager/types";

const MAX_RUNS = 50;

const runs = new Map<string, PipelineRunDiagnostic>();
const runOrder: string[] = [];

type StartStepInput = {
  runId: string;
  jobId?: string | null;
  organizationId?: string | null;
  step: PipelineStepName;
  providerId?: string | null;
};

type CompleteStepInput = {
  runId: string;
  stepId: string;
  resultCount?: number;
  errorCount?: number;
  responseSize?: number;
  errors?: string[];
};

function trimRuns(): void {
  while (runOrder.length > MAX_RUNS) {
    const oldest = runOrder.shift();
    if (oldest) runs.delete(oldest);
  }
}

export function startPipelineRun(input: {
  jobId?: string | null;
  organizationId?: string | null;
}): string {
  const id = randomUUID();
  const startedAt = new Date().toISOString();

  runs.set(id, {
    id,
    jobId: input.jobId ?? null,
    organizationId: input.organizationId ?? null,
    startedAt,
    completedAt: null,
    totalDurationMs: 0,
    steps: [],
    status: "running",
  });

  runOrder.unshift(id);
  trimRuns();

  return id;
}

export function startPipelineStep(input: StartStepInput): string {
  const run = runs.get(input.runId);
  if (!run) return randomUUID();

  const stepId = randomUUID();
  const startedAt = new Date().toISOString();

  const step: PipelineStepDiagnostic = {
    id: stepId,
    jobId: input.jobId ?? run.jobId,
    step: input.step,
    providerId: input.providerId ?? null,
    durationMs: 0,
    resultCount: 0,
    errorCount: 0,
    responseSize: 0,
    errors: [],
    startedAt,
    completedAt: startedAt,
  };

  run.steps.push(step);
  return stepId;
}

export function completePipelineStep(input: CompleteStepInput): void {
  for (const run of runs.values()) {
    const step = run.steps.find((entry) => entry.id === input.stepId);
    if (!step) continue;

    const completedAt = new Date().toISOString();
    step.completedAt = completedAt;
    step.durationMs = new Date(completedAt).getTime() - new Date(step.startedAt).getTime();
    step.resultCount = input.resultCount ?? step.resultCount;
    step.errorCount = input.errorCount ?? step.errorCount;
    step.responseSize = input.responseSize ?? step.responseSize;
    step.errors = input.errors ?? step.errors;
    return;
  }
}

export function failPipelineStep(stepId: string, error: string): void {
  for (const run of runs.values()) {
    const step = run.steps.find((entry) => entry.id === stepId);
    if (!step) continue;

    completePipelineStep({
      runId: run.id,
      stepId,
      errorCount: 1,
      errors: [error],
    });
    return;
  }
}

export function completePipelineRun(runId: string, status: "completed" | "failed" = "completed"): void {
  const run = runs.get(runId);
  if (!run) return;

  run.completedAt = new Date().toISOString();
  run.totalDurationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  run.status = status;
}

export function getPipelineRuns(limit = 20): PipelineRunDiagnostic[] {
  return runOrder
    .slice(0, limit)
    .map((id) => runs.get(id))
    .filter((run): run is PipelineRunDiagnostic => Boolean(run));
}

export function getPipelineRun(runId: string): PipelineRunDiagnostic | null {
  return runs.get(runId) ?? null;
}

export function getPipelineRunsForJob(jobId: string): PipelineRunDiagnostic[] {
  return getPipelineRuns(MAX_RUNS).filter((run) => run.jobId === jobId);
}
