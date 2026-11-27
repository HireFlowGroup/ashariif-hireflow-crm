"use client";

import type { AiRecruiterRun } from "@/features/ai-recruiter/domain/types";
import type { PipelineFunnelDiagnostics } from "@/features/ai-recruiter/domain/pipeline-funnel-diagnostics.types";

type DiscoveryProviderStatusProps = {
  run: AiRecruiterRun;
};

function getFunnel(run: AiRecruiterRun): PipelineFunnelDiagnostics | null {
  return run.settings?.pipelineFunnel ?? null;
}

export function DiscoveryProviderStatus({ run }: DiscoveryProviderStatusProps) {
  const funnel = getFunnel(run);
  const degraded = funnel?.providerDegradedMode;

  if (!funnel?.providerUsed && !degraded?.messages?.length) {
    return null;
  }

  const primary = degraded?.primaryProvider ?? funnel?.providerUsed ?? "—";
  const fallbacks = degraded?.activeFallbackProviders?.filter((id) => id !== primary) ?? [];

  return (
    <div className="mb-4 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
      <p className="font-medium">Discovery providers</p>
      <p className="mt-1 text-muted-foreground">
        Actief: <span className="text-foreground">{primary}</span>
        {fallbacks.length > 0 ? (
          <>
            {" "}
            · fallback: {fallbacks.join(", ")}
          </>
        ) : null}
        {(funnel?.providerFailoverCount ?? 0) > 0 ? (
          <>
            {" "}
            · failover-gebeurtenissen: {funnel!.providerFailoverCount}
          </>
        ) : null}
      </p>
      {degraded?.quotaExhaustedProviders?.length ? (
        <p className="mt-1 text-amber-800 dark:text-amber-200">
          Quota uitgeput: {degraded.quotaExhaustedProviders.join(", ")}
        </p>
      ) : null}
      {degraded?.messages?.map((line) => (
        <p key={line} className="mt-1 text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}