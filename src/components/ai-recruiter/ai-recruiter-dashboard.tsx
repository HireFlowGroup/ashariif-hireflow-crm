"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Check,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";

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

const EXAMPLE_PROMPT =
  "Zoek 25 softwarebedrijven in Rotterdam en Den Haag met 20 tot 200 medewerkers die recruiters, accountmanagers of customer success managers zoeken. Geef prioriteit aan bedrijven met meerdere vacatures en maak voor de beste 10 een persoonlijke introductiemail.";

export function AiRecruiterDashboard() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPT);
  const [runName, setRunName] = useState("AI Recruiter run");
  const [plan, setPlan] = useState<AiRecruiterSearchPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [runs, setRuns] = useState<AiRecruiterRun[]>([]);
  const [activeRun, setActiveRun] = useState<AiRecruiterRun | null>(null);
  const [items, setItems] = useState<AiRecruiterRunItem[]>([]);
  const [pipelineSteps, setPipelineSteps] = useState<AiRecruiterPipelineStep[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/ai-recruiter/runs");
    if (res.ok) {
      const data = (await res.json()) as { runs: AiRecruiterRun[] };
      setRuns(data.runs);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;

  const reviewItems = useMemo(
    () => items.filter((i) => i.stage === "draft_created" || i.outreachMessageId),
    [items],
  );

  async function parsePlan() {
    setPlanLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-recruiter/parse-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as { plan?: AiRecruiterSearchPlan; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Plan kon niet worden geparsed");
      setPlan(data.plan ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse mislukt");
    } finally {
      setPlanLoading(false);
    }
  }

  async function startRun() {
    if (!plan) {
      await parsePlan();
      return;
    }

    setError(null);
    setStreaming(true);

    try {
      const createRes = await fetch("/api/ai-recruiter/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: runName, prompt, searchPlan: plan }),
      });
      const createData = (await createRes.json()) as { run?: AiRecruiterRun; error?: string };
      if (!createRes.ok || !createData.run) throw new Error(createData.error ?? "Run aanmaken mislukt");

      const runId = createData.run.id;
      setActiveRun(createData.run);

      const eventSource = new EventSource(`/api/ai-recruiter/runs/${runId}/stream`);

      eventSource.addEventListener("run_status", (e) => {
        const data = JSON.parse(e.data) as { status: AiRecruiterRun["status"]; message?: string };
        setActiveRun((prev) => (prev ? { ...prev, status: data.status } : prev));
      });

      eventSource.addEventListener("pipeline", (e) => {
        const data = JSON.parse(e.data) as { steps: AiRecruiterPipelineStep[] };
        setPipelineSteps(data.steps);
      });

      eventSource.addEventListener("item", (e) => {
        const data = JSON.parse(e.data) as { item: AiRecruiterRunItem };
        setItems((prev) => {
          const exists = prev.find((i) => i.id === data.item.id);
          if (exists) return prev.map((i) => (i.id === data.item.id ? data.item : i));
          return [data.item, ...prev];
        });
      });

      eventSource.addEventListener("counters", (e) => {
        const data = JSON.parse(e.data) as { counters: AiRecruiterRun["counters"] };
        setActiveRun((prev) => (prev ? { ...prev, counters: data.counters } : prev));
      });

      eventSource.addEventListener("complete", (e) => {
        const data = JSON.parse(e.data) as { run: AiRecruiterRun };
        setActiveRun(data.run);
        setStreaming(false);
        eventSource.close();
        void loadRuns();
        void loadRunDetails(runId);
      });

      eventSource.addEventListener("error", () => {
        setStreaming(false);
        eventSource.close();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run starten mislukt");
      setStreaming(false);
    }
  }

  async function loadRunDetails(runId: string) {
    const res = await fetch(`/api/ai-recruiter/runs/${runId}`);
    if (res.ok) {
      const data = (await res.json()) as { run: AiRecruiterRun; items: AiRecruiterRunItem[] };
      setActiveRun(data.run);
      setItems(data.items);
      setPipelineSteps(data.run.pipelineSteps);
    }
  }

  async function approveItem(messageId: string) {
    await fetch(`/api/outreach/messages/${messageId}/approve`, { method: "POST" });
    if (activeRun) void loadRunDetails(activeRun.id);
  }

  async function sendTest(messageId: string) {
    if (!testEmail) return;
    await fetch(`/api/outreach/messages/${messageId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true, testRecipientEmail: testEmail }),
    });
  }

  return (
    <WorkspacePage
      title="AI Recruiter"
      description="Autonome prospectresearch — geen verzending zonder goedkeuring."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline">MANUAL · SEND_DISABLED</Badge>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadRuns()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

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
                <Button type="button" size="sm" disabled={streaming} onClick={() => void startRun()}>
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
                <p><span className="text-muted-foreground">Medewerkers:</span> {plan.employee_range.min ?? "?"}–{plan.employee_range.max ?? "?"}</p>
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
              {runs.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen runs.</p> : null}
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  className="w-full py-2 text-left text-sm hover:bg-muted/30"
                  onClick={() => void loadRunDetails(run.id)}
                >
                  <p className="font-medium">{run.name}</p>
                  <p className="text-xs text-muted-foreground">{run.status} · {run.counters.draftsCreated} concepten</p>
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
                    <span>Gevonden: {activeRun.counters.found}</span>
                    <span>Gevalideerd: {activeRun.counters.validated}</span>
                    <span>Contact: {activeRun.counters.contactFound}</span>
                    <span>Concepten: {activeRun.counters.draftsCreated}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(pipelineSteps.length ? pipelineSteps : activeRun.pipelineSteps).map((step) => (
                      <div key={step.id} className="rounded-md border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>{step.label}</span>
                          <Badge variant="outline" className="text-[10px]">{step.status}</Badge>
                        </div>
                        {step.durationMs ? (
                          <p className="text-xs text-muted-foreground">{step.durationMs}ms · ✓{step.succeeded} / skip {step.skipped}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="divide-y rounded-xl border max-h-[400px] overflow-y-auto">
                  <div className="px-4 py-2 text-sm font-medium bg-muted/30">Review queue ({reviewItems.length})</div>
                  {reviewItems.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-muted-foreground">Nog geen concepten.</p>
                  ) : (
                    reviewItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full px-4 py-3 text-left hover:bg-muted/30 ${selectedItemId === item.id ? "bg-muted/50" : ""}`}
                        onClick={() => setSelectedItemId(item.id)}
                      >
                        <p className="font-medium">{item.companyName ?? "Bedrijf"}</p>
                        <p className="text-xs text-muted-foreground">Score {item.totalScore ?? "—"} · {item.recipientEmail ?? "geen ontvanger"}</p>
                      </button>
                    ))
                  )}
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Prospect review</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {selectedItem ? (
                      <>
                        <p><span className="text-muted-foreground">Bedrijf:</span> {selectedItem.companyName}</p>
                        <p><span className="text-muted-foreground">Locatie:</span> {selectedItem.companyCity ?? "—"}</p>
                        <p><span className="text-muted-foreground">Sector:</span> {selectedItem.companySector ?? "—"}</p>
                        <p><span className="text-muted-foreground">Contact:</span> {selectedItem.contactName ?? "—"}</p>
                        <p><span className="text-muted-foreground">Ontvanger:</span> {selectedItem.recipientEmail ?? "—"}</p>
                        <p><span className="text-muted-foreground">Score:</span> {selectedItem.totalScore ?? "—"}</p>
                        <p><span className="text-muted-foreground">Onderwerp:</span> {selectedItem.draftSubject ?? "—"}</p>
                        {(selectedItem.warnings?.length ?? 0) > 0 ? (
                          <div className="text-amber-700 text-xs">{selectedItem.warnings.join(" · ")}</div>
                        ) : null}
                        {selectedItem.outreachMessageId ? (
                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => void approveItem(selectedItem.outreachMessageId!)}>
                              <Check className="size-4" /> Goedkeuren
                            </Button>
                            <input
                              className="rounded-md border px-2 py-1 text-xs"
                              placeholder="test@jouw.nl"
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                            />
                            <Button type="button" size="sm" variant="secondary" disabled={!testEmail} onClick={() => void sendTest(selectedItem.outreachMessageId!)}>
                              <Send className="size-4" /> Testmail
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-muted-foreground">Selecteer een prospect.</p>
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
