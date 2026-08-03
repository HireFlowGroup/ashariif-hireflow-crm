"use client";

import { useMemo, useState } from "react";
import { Loader2, Search, Sparkles, X } from "lucide-react";

import { DerivedFiltersEditor } from "@/components/companies/derived-filters-editor";
import { CompanySearchPipelineTimeline, useCompanySearchStream } from "@/components/companies/use-company-search-stream";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyFinderProgress } from "@/features/company-finder/domain";
import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import {
  derivedFiltersToCriteria,
  EXAMPLE_SEARCH_QUERIES,
  type DerivedSearchFilters,
} from "@/features/intelligent-search";

type DialogPhase = "input" | "review" | "running" | "complete";

type CompanyFinderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
};

type RecentCandidate = {
  name: string;
  city: string | null;
  saved: boolean;
  updated: boolean;
  skipped: boolean;
  leadScore?: number | null;
  leadPriority?: string | null;
};

export function CompanyFinderDialog({
  open,
  onOpenChange,
  onCompleted,
}: CompanyFinderDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>("input");
  const [query, setQuery] = useState("");
  const [derivedFilters, setDerivedFilters] = useState<DerivedSearchFilters | null>(null);
  const [sourceQuery, setSourceQuery] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enrichmentNotice, setEnrichmentNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    foundCount: number;
    savedCount: number;
    updatedCount: number;
    skippedCount: number;
    errorCount: number;
  } | null>(null);

  const streamEnabled = phase === "running" || phase === "complete";

  const {
    steps: pipelineSteps,
    progress,
    recentCandidates,
    qualityReport,
    errorMessage: streamError,
    isConnected,
    isComplete: streamComplete,
    cancel: cancelStream,
  } = useCompanySearchStream({
    jobId: activeJobId,
    enabled: streamEnabled && Boolean(activeJobId),
    onCompleted: (payload) => {
      setSummary({
        foundCount: payload.foundCount,
        savedCount: payload.savedCount,
        updatedCount: payload.updatedCount,
        skippedCount: payload.skippedCount,
        errorCount: payload.errorCount,
      });
      if (payload.status === "partially_completed") {
        setEnrichmentNotice("Discovery voltooid. Verrijking deels mislukt.");
      }
      setPhase("complete");
      onCompleted();
    },
    onEnrichmentPartial: (message) => setEnrichmentNotice(message),
  });

  const isRunning = phase === "running" && !streamComplete;

  const progressLabel = useMemo(
    () => progress?.message ?? "Klaar om te zoeken",
    [progress],
  );

  if (!open) return null;

  function resetState() {
    cancelStream();
    setPhase("input");
    setQuery("");
    setDerivedFilters(null);
    setSourceQuery("");
    setActiveJobId(null);
    setErrorMessage(null);
    setSummary(null);
    setEnrichmentNotice(null);
    setIsStarting(false);
  }

  function handleClose() {
    if (isRunning || isParsing || isStarting) return;
    resetState();
    onOpenChange(false);
  }

  async function handleParseQuery() {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      setErrorMessage("Beschrijf je zoekopdracht in minimaal 3 tekens.");
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/company-finder/parse-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        filters?: DerivedSearchFilters;
        message?: string;
        code?: string;
        error?: { message?: string; code?: string };
      };

      if (!response.ok || payload.success === false || !payload.filters) {
        throw new Error(
          extractApiErrorMessage(payload, "Kon zoekfilters niet afleiden."),
        );
      }

      setDerivedFilters(payload.filters);
      setSourceQuery(trimmed);
      setPhase("review");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Kon zoekfilters niet afleiden.",
      );
    } finally {
      setIsParsing(false);
    }
  }

  async function handleStartSearch() {
    if (!derivedFilters) return;

    setIsStarting(true);
    setErrorMessage(null);
    setSummary(null);
    setActiveJobId(null);
    setPhase("running");

    const criteria = { ...derivedFiltersToCriteria(derivedFilters, sourceQuery), fastMode: true };

    try {
      const createResponse = await fetch("/api/company-finder/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });

      const createPayload = (await createResponse.json()) as {
        success?: boolean;
        jobId?: string;
        message?: string;
        error?: string;
        details?: string;
      };

      if (!createResponse.ok || createPayload.success === false) {
        const message =
          createPayload.message
          ?? createPayload.error
          ?? createPayload.details
          ?? "Zoekjob kon niet worden gestart.";
        throw new Error(message);
      }

      const jobId = createPayload.jobId;

      if (!jobId) {
        throw new Error("Zoekjob kon niet worden gestart: geen job-id ontvangen.");
      }

      setActiveJobId(jobId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Er ging iets mis. Probeer het opnieuw.",
      );
      setPhase("review");
    } finally {
      setIsStarting(false);
    }
  }

  const displayError = errorMessage ?? streamError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Intelligente bedrijfszoeker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Beschrijf in natuurlijke taal wat je zoekt. AI vertaalt je prompt naar filters —
            controleer en pas aan voordat de zoekopdracht start.
          </p>

          {phase === "input" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="intelligent-search-query">Zoekopdracht</Label>
                <Textarea
                  id="intelligent-search-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Bijv. Zoek softwarebedrijven in Amsterdam met 20-100 medewerkers."
                  rows={3}
                  disabled={isParsing}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void handleParseQuery();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Voorbeelden</p>
                <div className="flex flex-col gap-1.5">
                  {EXAMPLE_SEARCH_QUERIES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      disabled={isParsing}
                      onClick={() => setQuery(example)}
                      className="rounded-md border border-dashed px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {phase === "review" || phase === "running" || phase === "complete" ? (
            derivedFilters ? (
              <DerivedFiltersEditor
                filters={derivedFilters}
                onChange={setDerivedFilters}
                disabled={isRunning || phase === "complete"}
              />
            ) : null
          ) : null}

          {(progress || isRunning || isStarting) && phase !== "input" ? (
            <div className="space-y-3 rounded-md border bg-muted/30 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{progressLabel}</p>
                {isConnected ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Live SSE</span>
                ) : null}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress?.progressPercent ?? 5}%` }}
                />
              </div>
              {progress ? (
                <p className="text-muted-foreground">
                  Gevonden: {progress.foundCount} · Toegevoegd: {progress.savedCount} · Bijgewerkt:{" "}
                  {progress.updatedCount} · Overgeslagen: {progress.skippedCount}
                  {progress.errorCount > 0 ? ` · Opslag/providerfouten: ${progress.errorCount}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {(phase === "running" || phase === "complete") && pipelineSteps.length > 0 ? (
            <CompanySearchPipelineTimeline steps={pipelineSteps} />
          ) : null}

          {recentCandidates.length > 0 ? (
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border px-3 py-2 text-sm">
              {recentCandidates.map((candidate, index) => (
                <div key={`${candidate.name}-${index}`} className="flex justify-between gap-2">
                  <span className="truncate font-medium">
                    {candidate.name}
                    {candidate.leadPriority ? ` · ${candidate.leadPriority}` : ""}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {candidate.saved ? "toegevoegd" : candidate.updated ? "bijgewerkt" : "overgeslagen"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {enrichmentNotice ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {enrichmentNotice}
            </p>
          ) : null}

          {qualityReport ? (
            <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium">Discovery kwaliteit</p>
              <p className="mt-1 text-muted-foreground">
                {qualityReport.totalUrls} URLs · {qualityReport.rejected} afgewezen ·{" "}
                {qualityReport.realCompanies} echte bedrijven · {qualityReport.saved} opgeslagen
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Directories: {qualityReport.directories + qualityReport.listings} · Blogs/nieuws:{" "}
                {qualityReport.blogs + qualityReport.news} · Gemeente/overheid: {qualityReport.government}
              </p>
            </div>
          ) : null}

          {summary ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {summary.foundCount} gevonden · {summary.savedCount} toegevoegd · {summary.updatedCount}{" "}
              bijgewerkt · {summary.skippedCount} overgeslagen
              {summary.errorCount > 0 ? ` · ${summary.errorCount} providerfouten` : ""}
            </p>
          ) : null}

          {displayError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {displayError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            {isRunning ? (
              <Button type="button" variant="outline" onClick={() => { cancelStream(); setPhase("review"); }}>
                <X className="size-4" />
                Annuleren
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleClose}>
                {phase === "complete" ? "Sluiten" : "Annuleren"}
              </Button>
            )}

            {phase === "input" ? (
              <Button
                type="button"
                onClick={() => void handleParseQuery()}
                disabled={isParsing || query.trim().length < 3}
              >
                {isParsing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Analyseren…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Filters afleiden
                  </>
                )}
              </Button>
            ) : null}

            {phase === "review" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPhase("input");
                    setErrorMessage(null);
                  }}
                >
                  Terug
                </Button>
                <Button type="button" onClick={() => void handleStartSearch()} disabled={isRunning || isStarting}>
                  <Search className="size-4" />
                  {isStarting ? "Starten…" : "Start zoeken"}
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
