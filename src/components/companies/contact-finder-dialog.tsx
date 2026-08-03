"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContactFinderProgress } from "@/features/contact-finder/domain";
import type { ContactFinderStreamEvent } from "@/lib/contact-finder/stream-events";

type ContactFinderDialogProps = {
  open: boolean;
  companyId: string | null;
  companyName: string | null;
  autoStart?: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
};

type RecentCandidate = {
  name: string;
  jobTitle: string | null;
  saved: boolean;
  skipped: boolean;
};

export function ContactFinderDialog({
  open,
  companyId,
  companyName,
  autoStart = true,
  onOpenChange,
  onCompleted,
}: ContactFinderDialogProps) {
  const startedRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<ContactFinderProgress | null>(null);
  const [recentCandidates, setRecentCandidates] = useState<RecentCandidate[]>([]);
  const [summary, setSummary] = useState<{
    foundCount: number;
    savedCount: number;
    skippedCount: number;
    errorCount: number;
  } | null>(null);

  const isComplete = summary !== null;

  const progressLabel = useMemo(() => {
    if (!progress) {
      return "Zoeken gestart…";
    }

    return progress.message;
  }, [progress]);

  const runSearch = useCallback(
    async (activeCompanyId: string) => {
      setIsRunning(true);
      setErrorMessage(null);
      setProgress(null);
      setRecentCandidates([]);
      setSummary(null);

      try {
        const createResponse = await fetch("/api/contact-finder/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: activeCompanyId }),
        });

        if (!createResponse.ok) {
          const payload = (await createResponse.json()) as { error?: string };
          throw new Error(payload.error ?? "Zoekjob kon niet worden gestart.");
        }

        const { jobId } = (await createResponse.json()) as { jobId: string };

        const streamResponse = await fetch(`/api/contact-finder/jobs/${jobId}/stream`);

        if (!streamResponse.ok || !streamResponse.body) {
          throw new Error("Live voortgang kon niet worden gestart.");
        }

        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed) {
              continue;
            }

            const event = JSON.parse(trimmed) as ContactFinderStreamEvent;

            if (event.type === "progress") {
              setProgress(event.progress);
            }

            if (event.type === "candidate") {
              setRecentCandidates((current) =>
                [{ ...event }, ...current].slice(0, 8),
              );
            }

            if (event.type === "complete") {
              setSummary({
                foundCount: event.foundCount,
                savedCount: event.savedCount,
                skippedCount: event.skippedCount,
                errorCount: event.errorCount,
              });
              setProgress({
                phase: "complete",
                message: `${event.foundCount} contacten gevonden`,
                foundCount: event.foundCount,
                savedCount: event.savedCount,
                skippedCount: event.skippedCount,
                errorCount: event.errorCount,
                progressPercent: 100,
              });
              onCompleted();
            }

            if (event.type === "error") {
              throw new Error(event.message);
            }
          }
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Er ging iets mis. Probeer het opnieuw.",
        );
      } finally {
        setIsRunning(false);
      }
    },
    [onCompleted],
  );

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setIsRunning(false);
      setErrorMessage(null);
      setProgress(null);
      setRecentCandidates([]);
      setSummary(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !companyId || !autoStart || startedRef.current || isRunning || isComplete) {
      return;
    }

    startedRef.current = true;
    void runSearch(companyId);
  }, [open, companyId, autoStart, isRunning, isComplete, runSearch]);

  function handleClose() {
    if (isRunning) {
      return;
    }

    onOpenChange(false);
  }

  if (!open || !companyId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Contactpersonen zoeken
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Zoek beslissers voor{" "}
            <span className="font-medium text-foreground">{companyName ?? "dit bedrijf"}</span>.
            Alleen unieke contacten worden opgeslagen.
          </p>

          {(progress || isRunning) && (
            <div className="space-y-2 rounded-md border bg-muted/30 px-4 py-3 text-sm">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress?.progressPercent ?? 5}%` }}
                />
              </div>
              <p className="font-medium">{progressLabel}</p>
              {progress ? (
                <p className="text-muted-foreground">
                  Gevonden: {progress.foundCount} · Toegevoegd: {progress.savedCount} ·
                  Overgeslagen: {progress.skippedCount}
                  {progress.errorCount > 0 ? ` · Fouten: ${progress.errorCount}` : ""}
                </p>
              ) : null}
            </div>
          )}

          {recentCandidates.length > 0 ? (
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border px-3 py-2 text-sm">
              {recentCandidates.map((candidate, index) => (
                <div key={`${candidate.name}-${index}`} className="flex justify-between gap-2">
                  <div className="min-w-0 truncate">
                    <span className="font-medium">{candidate.name}</span>
                    {candidate.jobTitle ? (
                      <span className="text-muted-foreground"> · {candidate.jobTitle}</span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {candidate.saved ? "toegevoegd" : "overgeslagen"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {summary ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {summary.foundCount} contacten gevonden ({summary.savedCount} toegevoegd,{" "}
              {summary.skippedCount} duplicaten overgeslagen
              {summary.errorCount > 0 ? `, ${summary.errorCount} fouten` : ""}).
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isRunning}>
              {isComplete ? "Sluiten" : "Annuleren"}
            </Button>
            {!isComplete && errorMessage ? (
              <Button
                type="button"
                onClick={() => {
                  startedRef.current = true;
                  void runSearch(companyId);
                }}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Zoeken…
                  </>
                ) : (
                  "Opnieuw proberen"
                )}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
