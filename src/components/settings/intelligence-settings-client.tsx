"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ScanRun = {
  id: string;
  triggeredBy: string;
  status: string;
  companiesTotal: number;
  companiesProcessed: number;
  signalsCreated: number;
  signalsUpdated: number;
  notificationsCreated: number;
  errorsCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

function statusVariant(status: string) {
  switch (status) {
    case "completed":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    case "running":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function IntelligenceSettingsClient() {
  const [runs, setRuns] = useState<ScanRun[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/intelligence/scan-runs");
      if (!response.ok) throw new Error("Scans laden mislukt.");
      const data = (await response.json()) as { runs: ScanRun[]; configured: boolean };
      setRuns(data.runs);
      setConfigured(data.configured);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function triggerScan() {
    setTriggering(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/intelligence/scan-runs", { method: "POST" });
      const data = (await response.json()) as { error?: string; jobsEnqueued?: number; runId?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Scan starten mislukt.");
      }

      setMessage(
        `Scan gestart (${data.jobsEnqueued ?? 0} bedrijven in queue). Run ID: ${data.runId ?? "—"}`,
      );
      await load();
    } catch (triggerError) {
      setError(triggerError instanceof Error ? triggerError.message : "Onbekende fout");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Nachtelijke hiring scans, queue workers en notificaties bij wijzigingen.
        </p>
      </div>

      {!configured ? (
        <Card>
          <CardHeader>
            <CardTitle>Niet geconfigureerd</CardTitle>
            <CardDescription>
              Stel <code>SUPABASE_SERVICE_ROLE_KEY</code> en <code>CRON_SECRET</code> in voor
              productie-scans.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Scan runs</CardTitle>
            <CardDescription>
              Elke nacht om 02:00 UTC worden alle bedrijven gescand op hiring signals.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
            <Button size="sm" onClick={() => void triggerScan()} disabled={triggering || !configured}>
              {triggering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Scan nu
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          {message ? <p className="mb-4 text-sm text-muted-foreground">{message}</p> : null}

          {loading && runs.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Laden…
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen scan runs.</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                      <span className="text-sm font-medium">
                        {run.triggeredBy === "cron" ? "Nachtelijke cron" : "Handmatig"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString("nl-NL")}
                      {run.completedAt
                        ? ` · afgerond ${new Date(run.completedAt).toLocaleString("nl-NL")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      {run.companiesProcessed}/{run.companiesTotal} bedrijven
                    </span>
                    <span>{run.signalsCreated} nieuwe signals</span>
                    <span>{run.signalsUpdated} bijgewerkt</span>
                    <span>{run.notificationsCreated} notificaties</span>
                    {run.errorsCount > 0 ? (
                      <span className="text-destructive">{run.errorsCount} fouten</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
