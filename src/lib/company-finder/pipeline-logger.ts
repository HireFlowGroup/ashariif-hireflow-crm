export type PipelineLogPhase = "DISCOVERY" | "ENRICHMENT" | "AI" | "SAVE" | "REJECT";

export type PipelineLogStatus = "started" | "completed" | "failed" | "skipped";

export function logPipelinePhase(input: {
  phase: PipelineLogPhase;
  provider: string;
  company?: string | null;
  status: PipelineLogStatus;
  durationMs?: number;
  error?: unknown;
  resultCount?: number;
  jobId?: string;
}): void {
  const errorMessage =
    input.error instanceof Error
      ? input.error.message
      : input.error
        ? String(input.error)
        : null;
  const stack = input.error instanceof Error ? input.error.stack : undefined;

  const payload = {
    phase: input.phase,
    provider: input.provider,
    company: input.company ?? null,
    status: input.status,
    durationMs: input.durationMs ?? null,
    resultCount: input.resultCount ?? null,
    error: errorMessage,
    stack: input.status === "failed" ? stack : undefined,
    jobId: input.jobId ?? null,
  };

  if (input.status === "failed") {
    console.warn(`[${input.phase}]`, payload);
  } else {
    console.info(`[${input.phase}]`, payload);
  }
}

/** Log the exact rejection reason for every afgewezen URL. */
export function logDiscoveryRejection(input: {
  url: string;
  title: string;
  reason: string;
  detail: string;
  score?: number;
  jobId?: string;
}): void {
  console.info("[REJECT]", {
    phase: "REJECT",
    url: input.url,
    title: input.title,
    reason: input.reason,
    detail: input.detail,
    score: input.score ?? null,
    jobId: input.jobId ?? null,
  });
}
