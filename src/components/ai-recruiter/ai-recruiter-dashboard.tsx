"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrainCircuit,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { ProspectDecisionsPanel } from "@/components/ai-recruiter/prospect-decisions-panel";
import { ProspectDossierPanel } from "@/components/ai-recruiter/prospect-dossier-panel";
import { PipelineStepStats, RunFailureBanner } from "@/components/ai-recruiter/run-failure-banner";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AiRecruiterPipelineStep,
  AiRecruiterRun,
  AiRecruiterRunItem,
  AiRecruiterSearchPlan,
} from "@/features/ai-recruiter/domain/types";
import {
  aiRecruiterFetchJson,
  buildRunDetailPath,
  logAiRecruiterClientError,
  openRecruiterEventSource,
  toAiRecruiterClientError,
} from "@/lib/ai-recruiter/client-api";
import { assertUuid } from "@/lib/ai-recruiter/client-errors";

const EXAMPLE_PROMPT =
  "Zoek 25 softwarebedrijven in Rotterdam en Den Haag met 20 tot 200 medewerkers die recruiters, accountmanagers of customer success managers zoeken. Geef prioriteit aan bedrijven met meerdere vacatures en maak voor de beste 10 een persoonlijke introductiemail.";

function normalizeSearchPlan(plan: AiRecruiterSearchPlan): AiRecruiterSearchPlan {
  return {
    ...plan,
    employee_range: plan.employee_range ?? { min: null, max: null },
    locations: plan.locations ?? [],
    sectors: plan.sectors ?? [],
    desired_roles: plan.desired_roles ?? [],
    uncertainties: plan.uncertainties ?? [],
  };
}

export function AiRecruiterDashboard() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPT);
  const [runName, setRunName] = useState("AI Recruiter run");
  const [plan, setPlan] = useState<AiRecruiterSearchPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [runs, setRuns] = useState<AiRecruiterRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [activeRun, setActiveRun] = useState<AiRecruiterRun | null>(null);
  const [items, setItems] = useState<AiRecruiterRunItem[]>([]);
  const [pipelineSteps, setPipelineSteps] = useState<AiRecruiterPipelineStep[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const reportError = useCallback((operation: string, cause: unknown) => {
    const clientError = toAiRecruiterClientError(cause, operation);
    logAiRecruiterClientError(clientError, operation);
    setError(clientError.message);
    return clientError;
  }, []);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);

    try {
      const { data } = await aiRecruiterFetchJson<{ runs: AiRecruiterRun[] }>(
        "loadRuns",
        "/api/ai-recruiter/runs",
      );
      setRuns(data.runs);
    } catch (cause) {
      reportError("loadRuns", cause);
    } finally {
      setRunsLoading(false);
    }
  }, [reportError]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const reviewItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.stage === "draft_created"
          || i.outreachMessageId
          || i.stage === "contact_found"
          || i.stage === "general_mailbox_found"
          || i.stage === "blocked_missing_contact",
      ),
    [items],
  );

  useEffect(() => {
    if (reviewItems.length === 0) {
      setSelectedItemId(null);
      return;
    }
    if (!selectedItemId || !reviewItems.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(reviewItems[0]!.id);
    }
  }, [reviewItems, selectedItemId]);

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;

  const parsePlan = useCallback(async (): Promise<AiRecruiterSearchPlan | null> => {
    setPlanLoading(true);
    setError(null);

    try {
      const { data } = await aiRecruiterFetchJson<{ plan: AiRecruiterSearchPlan }>(
        "parsePlan",
        "/api/ai-recruiter/parse-plan",
        {
          method: "POST",
          body: { prompt },
          expectedStatuses: [200],
        },
      );

      const normalized = normalizeSearchPlan(data.plan);
      setPlan(normalized);
      return normalized;
    } catch (cause) {
      reportError("parsePlan", cause);
      return null;
    } finally {
      setPlanLoading(false);
    }
  }, [prompt, reportError]);

  const loadRunDetails = useCallback(
    async (runId: string) => {
      try {
        assertUuid("loadRunDetails", "runId", runId);
        const { data } = await aiRecruiterFetchJson<{ run: AiRecruiterRun; items: AiRecruiterRunItem[] }>(
          "loadRunDetails",
          buildRunDetailPath(runId),
        );
        setActiveRun(data.run);
        setItems(data.items);
        setPipelineSteps(data.run.pipelineSteps ?? []);
      } catch (cause) {
        reportError("loadRunDetails", cause);
      }
    },
    [reportError],
  );

  const connectRunStream = useCallback(
    (runId: string) => {
      eventSourceRef.current?.close();

      const eventSource = openRecruiterEventSource("startRun", runId, {
        onRunStatus: (data) => {
          setActiveRun((prev) =>
            prev ? { ...prev, status: data.status as AiRecruiterRun["status"] } : prev,
          );
        },
        onPipeline: (data) => {
          setPipelineSteps(data.steps as AiRecruiterPipelineStep[]);
        },
        onItem: (data) => {
          const item = data.item as AiRecruiterRunItem;
          setItems((prev) => {
            const exists = prev.find((i) => i.id === item.id);
            if (exists) return prev.map((i) => (i.id === item.id ? item : i));
            return [item, ...prev];
          });
        },
        onCounters: (data) => {
          setActiveRun((prev) =>
            prev ? { ...prev, counters: data.counters as AiRecruiterRun["counters"] } : prev,
          );
        },
        onComplete: (data) => {
          const run = data.run as AiRecruiterRun;
          setActiveRun(run);
          setStreaming(false);
          eventSource.close();
          eventSourceRef.current = null;
          void loadRuns();
          void loadRunDetails(runId);
        },
        onError: (message) => {
          setStreaming(false);
          setError(message);
          eventSource.close();
          eventSourceRef.current = null;
        },
      });

      eventSourceRef.current = eventSource;
    },
    [loadRunDetails, loadRuns],
  );

  async function startRun() {
    setError(null);

    let activePlan = plan;
    if (!activePlan) {
      activePlan = await parsePlan();
      if (!activePlan) return;
    }

    setStreaming(true);

    try {
      const { data } = await aiRecruiterFetchJson<{ run: AiRecruiterRun }>(
        "createRun",
        "/api/ai-recruiter/runs",
        {
          method: "POST",
          body: { name: runName, prompt, searchPlan: activePlan },
          expectedStatuses: [201],
        },
      );

      assertUuid("startRun", "run.id", data.run.id);
      setActiveRun(data.run);
      connectRunStream(data.run.id);
    } catch (cause) {
      reportError("startRun", cause);
      setStreaming(false);
    }
  }

  const employeeRange = plan?.employee_range ?? { min: null, max: null };

  return (
    <WorkspacePage
      title="AI Recruiter"
      description="Autonome prospectresearch — geen verzending zonder goedkeuring."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline">MANUAL · SEND_DISABLED</Badge>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadRuns()} disabled={runsLoading}>
            <RefreshCw className={`size-4 ${runsLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {activeRun ? <RunFailureBanner run={activeRun} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="size-4" />
                Nieuwe run
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="Run naam"
              />
              <textarea
                className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={planLoading} onClick={() => void parsePlan()}>
                  {planLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                  Plan genereren
                </Button>
                <Button type="button" size="sm" disabled={streaming || planLoading} onClick={() => void startRun()}>
                  <Play className="size-4" />
                  {streaming ? "Run actief…" : "Run starten"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {plan ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Zoekplan (controle)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Locaties:</span> {plan.locations.join(", ") || "—"}</p>
                <p><span className="text-muted-foreground">Sectoren:</span> {plan.sectors.join(", ") || "—"}</p>
                <p><span className="text-muted-foreground">Medewerkers:</span> {employeeRange.min ?? "?"}–{employeeRange.max ?? "?"}</p>
                <p><span className="text-muted-foreground">Functies:</span> {plan.desired_roles.join(", ") || "—"}</p>
                <p><span className="text-muted-foreground">Max bedrijven:</span> {plan.maximum_companies}</p>
                <p><span className="text-muted-foreground">Max concepten:</span> {plan.maximum_drafts}</p>
                {plan.uncertainties.length > 0 ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-800 dark:text-amber-200">
                    <p className="font-medium flex items-center gap-1"><ShieldAlert className="size-3.5" /> Onzekerheden</p>
                    {plan.uncertainties.map((u) => <p key={u}>{u}</p>)}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">{plan.reasoning}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle className="text-base">Recente runs</CardTitle></CardHeader>
            <CardContent className="divide-y max-h-48 overflow-y-auto">
              {runsLoading ? (
                <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Runs laden…
                </p>
              ) : null}
              {!runsLoading && runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen runs.</p>
              ) : null}
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  className="w-full py-2 text-left text-sm hover:bg-muted/30"
                  onClick={() => void loadRunDetails(run.id)}
                >
                  <p className="font-medium">{run.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.status} · {run.counters?.draftsCreated ?? 0} concepten
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {activeRun ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Live pipeline — {activeRun.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap gap-2 text-xs">
                    <Badge>{activeRun.status}</Badge>
                    <span>Gevonden: {activeRun.counters?.found ?? 0}</span>
                    <span>Gevalideerd: {activeRun.counters?.validated ?? 0}</span>
                    <span>Vacatures: {activeRun.counters?.withVacancies ?? 0}</span>
                    <span>Contact: {activeRun.counters?.contactFound ?? 0}</span>
                    <span>Mailbox: {activeRun.counters?.generalMailboxFound ?? 0}</span>
                    <span>Geen contact: {activeRun.counters?.blockedMissingContact ?? 0}</span>
                    <span>Concepten: {activeRun.counters?.draftsCreated ?? 0}</span>
                  </div>
                  {activeRun.errorMessage ? (
                    <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                      {activeRun.errorMessage}
                    </p>
                  ) : null}
                  {(activeRun.counters?.draftsCreated ?? 0) === 0
                  && (activeRun.counters?.validated ?? 0) > 0
                  && !streaming ? (
                    <div className="mb-4">
                      <ProspectDecisionsPanel
                        runId={activeRun.id}
                        onDraftCreated={() => void loadRuns()}
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(pipelineSteps.length ? pipelineSteps : activeRun.pipelineSteps ?? []).map((step) => (
                      <div key={step.id} className="rounded-md border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>{step.label}</span>
                          <Badge variant="outline" className="text-[10px]">{step.status}</Badge>
                        </div>
                        {step.message ? (
                          <p className="text-xs text-muted-foreground mt-0.5">{step.message}</p>
                        ) : null}
                        <PipelineStepStats step={step} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4 xl:flex-row">
                <div className="w-full shrink-0 divide-y rounded-xl border xl:w-72 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
                  <div className="sticky top-0 z-10 border-b bg-muted/30 px-4 py-2 text-sm font-medium">
                    Prospect review ({reviewItems.length})
                  </div>
                  {reviewItems.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-muted-foreground">Nog geen prospects om te reviewen.</p>
                  ) : (
                    reviewItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full px-4 py-3 text-left hover:bg-muted/30 ${selectedItemId === item.id ? "bg-muted/50 ring-1 ring-inset ring-primary/20" : ""}`}
                        onClick={() => setSelectedItemId(item.id)}
                      >
                        <p className="font-medium">{item.companyName ?? "Bedrijf"}</p>
                        <p className="text-xs text-muted-foreground">
                          Score {item.totalScore ?? "—"} · {item.scoreBreakdown?.salesTier ?? item.stage}
                        </p>
                      </button>
                    ))
                  )}
                </div>

                <Card className="min-w-0 flex-1">
                  <CardHeader>
                    <CardTitle className="text-base">Bedrijfsdossier</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedItem && activeRun ? (
                      <ProspectDossierPanel
                        runId={activeRun.id}
                        item={selectedItem}
                        onItemUpdated={(updated) => {
                          setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
                        }}
                        onError={setError}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Selecteer een prospect uit de queue.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              Genereer een zoekplan en start een run om live voortgang te zien.
            </div>
          )}
        </div>
      </div>
    </WorkspacePage>
  );
}
