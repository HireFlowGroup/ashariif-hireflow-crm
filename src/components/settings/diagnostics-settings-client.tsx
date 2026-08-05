"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PipelineStepDiagnostic = {
  id: string;
  step: "discovery" | "crawler" | "enrichment" | "ai" | "storage" | "ui";
  providerId: string | null;
  durationMs: number;
  resultCount: number;
  errorCount: number;
  responseSize: number;
  errors: string[];
  startedAt: string;
  completedAt: string;
};

type PipelineRunDiagnostic = {
  id: string;
  jobId: string | null;
  organizationId: string | null;
  startedAt: string;
  completedAt: string | null;
  totalDurationMs: number;
  status: "running" | "completed" | "failed";
  steps: PipelineStepDiagnostic[];
};

type DiscoveryQueryRow = {
  query: string;
  intent: string;
  label: string;
  rawResultCount: number;
  companyResults: number;
  vacancyResults: number;
  directoryResults: number;
  rejectedResults: number;
  durationMs: number;
  error: string | null;
};

type DiscoveryQueryRun = {
  jobId: string;
  providerId: string;
  totalRawResults: number;
  classifiedCounts: Record<string, number>;
  queries: DiscoveryQueryRow[];
  recordedAt: string;
};

const STEP_ORDER: PipelineStepDiagnostic["step"][] = [
  "discovery",
  "crawler",
  "enrichment",
  "ai",
  "storage",
  "ui",
];

const STEP_LABELS: Record<PipelineStepDiagnostic["step"], string> = {
  discovery: "Discovery",
  crawler: "Crawler",
  enrichment: "Enrichment",
  ai: "AI",
  storage: "Opslag",
  ui: "UI",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVariant(status: PipelineRunDiagnostic["status"]) {
  switch (status) {
    case "completed":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export function DiagnosticsSettingsClient() {
  const [runs, setRuns] = useState<PipelineRunDiagnostic[]>([]);
  const [discoveryQueries, setDiscoveryQueries] = useState<DiscoveryQueryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedDiscoveryJobId, setSelectedDiscoveryJobId] = useState<string | null>(null);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/diagnostics?limit=20");
      const payload = (await response.json()) as {
        runs?: PipelineRunDiagnostic[];
        discoveryQueries?: DiscoveryQueryRun[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Diagnostics laden mislukt");
      }

      const nextRuns = payload.runs ?? [];
      const nextDiscovery = payload.discoveryQueries ?? [];
      setRuns(nextRuns);
      setDiscoveryQueries(nextDiscovery);
      setSelectedRunId((current) => current ?? nextRuns[0]?.id ?? null);
      setSelectedDiscoveryJobId((current) => current ?? nextDiscovery[0]?.jobId ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
    const interval = setInterval(() => void loadDiagnostics(), 10_000);
    return () => clearInterval(interval);
  }, [loadDiagnostics]);

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;
  const selectedDiscovery =
    discoveryQueries.find((entry) => entry.jobId === selectedDiscoveryJobId)
    ?? discoveryQueries[0]
    ?? null;

  const stepsByName = new Map(
    (selectedRun?.steps ?? []).map((step) => [step.step, step] as const),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline-stappen en discovery-queryresultaten per zoekjob.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadDiagnostics()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Vernieuwen
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recente runs</CardTitle>
            <CardDescription>Laatste pipeline-uitvoeringen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen pipeline runs geregistreerd.</p>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selectedRun?.id === run.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{run.jobId ? `Job ${run.jobId.slice(0, 8)}…` : "Run"}</span>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(run.startedAt).toLocaleString("nl-NL")} · {formatDuration(run.totalDurationMs)}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>
              Discovery → Crawler → Enrichment → AI → Opslag → UI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedRun ? (
              <p className="text-sm text-muted-foreground">Selecteer een run om details te zien.</p>
            ) : (
              <div className="space-y-0">
                {STEP_ORDER.map((stepName, index) => {
                  const step = stepsByName.get(stepName);

                  return (
                    <div key={stepName}>
                      <div className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{STEP_LABELS[stepName]}</div>
                            <div className="text-xs text-muted-foreground">{stepName}</div>
                          </div>
                          {step?.errorCount ? (
                            <Badge variant="destructive">{step.errorCount} fout(en)</Badge>
                          ) : (
                            <Badge variant="outline">OK</Badge>
                          )}
                        </div>

                        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                          <div>
                            <dt className="text-muted-foreground">Duur</dt>
                            <dd className="font-medium">{step ? formatDuration(step.durationMs) : "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Resultaten</dt>
                            <dd className="font-medium">{step?.resultCount ?? 0}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Fouten</dt>
                            <dd className="font-medium">{step?.errorCount ?? 0}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Provider</dt>
                            <dd className="font-medium">{step?.providerId ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Response size</dt>
                            <dd className="font-medium">{formatBytes(step?.responseSize ?? 0)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Tijdstip</dt>
                            <dd className="font-medium">
                              {step ? new Date(step.startedAt).toLocaleTimeString("nl-NL") : "—"}
                            </dd>
                          </div>
                        </dl>

                        {step?.errors?.length ? (
                          <ul className="mt-3 space-y-1 text-xs text-destructive">
                            {step.errors.map((entry) => (
                              <li key={entry}>{entry}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      {index < STEP_ORDER.length - 1 ? (
                        <div className="flex justify-center py-2 text-muted-foreground">
                          <ArrowDown className="size-4" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discovery queries</CardTitle>
          <CardDescription>
            Vacaturegedreven zoekqueries — provider, resultaten per query, classificatie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {discoveryQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen discovery-querydiagnostiek. Start een AI Recruiter-run om queries te zien.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {discoveryQueries.map((entry) => (
                  <Button
                    key={entry.jobId}
                    type="button"
                    size="sm"
                    variant={selectedDiscovery?.jobId === entry.jobId ? "default" : "outline"}
                    onClick={() => setSelectedDiscoveryJobId(entry.jobId)}
                  >
                    Job {entry.jobId.slice(0, 8)}… · {entry.queries.length} queries
                  </Button>
                ))}
              </div>

              {selectedDiscovery ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-4 text-sm">
                    <div className="rounded-lg border px-3 py-2">
                      <p className="text-muted-foreground">Provider</p>
                      <p className="font-medium">{selectedDiscovery.providerId}</p>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <p className="text-muted-foreground">Ruwe resultaten</p>
                      <p className="font-medium">{selectedDiscovery.totalRawResults}</p>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <p className="text-muted-foreground">Bedrijven</p>
                      <p className="font-medium">{selectedDiscovery.classifiedCounts.company ?? 0}</p>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <p className="text-muted-foreground">Vacatures</p>
                      <p className="font-medium">{selectedDiscovery.classifiedCounts.vacancy ?? 0}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/40 text-left">
                        <tr>
                          <th className="px-3 py-2">Label</th>
                          <th className="px-3 py-2">Query</th>
                          <th className="px-3 py-2">Ruwe</th>
                          <th className="px-3 py-2">Bedrijf</th>
                          <th className="px-3 py-2">Vacature</th>
                          <th className="px-3 py-2">Afgewezen</th>
                          <th className="px-3 py-2">Duur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDiscovery.queries.map((query) => (
                          <tr key={`${query.label}-${query.query}`} className="border-t">
                            <td className="px-3 py-2">{query.label}</td>
                            <td className="px-3 py-2 font-mono text-xs">{query.query}</td>
                            <td className="px-3 py-2">{query.rawResultCount}</td>
                            <td className="px-3 py-2">{query.companyResults}</td>
                            <td className="px-3 py-2">{query.vacancyResults}</td>
                            <td className="px-3 py-2">{query.rejectedResults}</td>
                            <td className="px-3 py-2">{formatDuration(query.durationMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
