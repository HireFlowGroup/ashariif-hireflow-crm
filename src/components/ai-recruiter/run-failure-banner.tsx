"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { AiRecruiterRun } from "@/features/ai-recruiter/domain/types";
import { buildRunFailureUiMessage } from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";

type RunFailureBannerProps = {
  run: AiRecruiterRun;
};

export function RunFailureBanner({ run }: RunFailureBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const diagnostics = run.diagnostics ?? run.settings.runDiagnostics ?? null;
  const uiMessage = diagnostics
    ? buildRunFailureUiMessage(diagnostics, run.status)
    : run.errorMessage
      ? {
          title: "AI Recruiter-run mislukt",
          body: run.errorMessage,
          retryRecommended: false,
          showProviderSettings: false,
          providerName: null,
        }
      : null;

  if (!uiMessage && !run.errorMessage) return null;
  if (run.status === "awaiting_approval" || run.status === "completed") return null;

  const isPartialQualification = run.status === "partially_completed";
  const showBanner =
    run.status === "failed"
    || (isPartialQualification && Boolean(run.errorMessage || uiMessage))
    || Boolean(uiMessage);

  if (!showBanner) return null;

  const tone = run.status === "failed"
    ? "destructive"
  : isPartialQualification
    ? "warning"
    : "destructive";

  const borderClass = tone === "warning"
    ? "border-amber-500/30 bg-amber-500/5"
    : "border-destructive/30 bg-destructive/5";
  const titleClass = tone === "warning" ? "text-amber-800 dark:text-amber-200" : "text-destructive";
  const bodyClass = tone === "warning" ? "text-amber-900/90 dark:text-amber-100/90" : "text-destructive/90";

  return (
    <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${borderClass}`}>
      <p className={`font-medium ${titleClass}`}>
        {uiMessage?.title ?? (isPartialQualification ? "Run deels afgerond" : "Run mislukt")}
      </p>
      <p className={`mt-1 ${bodyClass}`}>{uiMessage?.body ?? run.errorMessage}</p>
      {diagnostics?.providerName ? (
        <p className="mt-1 text-muted-foreground">
          Provider: {diagnostics.providerName}
          {diagnostics.providerActive === false ? " (niet geconfigureerd)" : ""}
        </p>
      ) : null}
      {uiMessage?.retryRecommended ? (
        <p className="mt-1 text-muted-foreground">Opnieuw proberen is zinvol met aangepaste criteria.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {uiMessage?.showProviderSettings ? (
          <Link
            href="/settings/providers"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Settings className="mr-1 size-3.5" />
            Settings → Providers
          </Link>
        ) : null}
        {diagnostics ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            Technische details
            {expanded ? <ChevronUp className="ml-1 size-3.5" /> : <ChevronDown className="ml-1 size-3.5" />}
          </Button>
        ) : null}
      </div>
      {expanded && diagnostics ? (
        <div className="mt-3 rounded border bg-background/80 p-3 text-xs text-muted-foreground space-y-1">
          <p><span className="font-medium">run_id:</span> {run.id}</p>
          <p><span className="font-medium">provider:</span> {diagnostics.providerName ?? "—"}</p>
          <p><span className="font-medium">error_code:</span> {diagnostics.errorCode ?? "—"}</p>
          <p><span className="font-medium">timestamp:</span> {diagnostics.timestamp}</p>
          <p>
            <span className="font-medium">counts:</span>{" "}
            ontvangen {diagnostics.responseCount} · genormaliseerd {diagnostics.normalizedCount} · afgewezen {diagnostics.rejectedCount}
          </p>
          {diagnostics.durationMs != null ? (
            <p><span className="font-medium">duration_ms:</span> {diagnostics.durationMs}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PipelineStepStats({ step }: { step: AiRecruiterRun["pipelineSteps"][number] }) {
  return (
    <p className="text-xs text-muted-foreground">
      ontvangen {step.processed} · geslaagd {step.succeeded} · afgewezen {step.skipped} · fouten {step.errors}
      {step.durationMs ? ` · ${step.durationMs}ms` : ""}
    </p>
  );
}
