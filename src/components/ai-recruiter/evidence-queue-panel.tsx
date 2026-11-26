"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EvidenceQueueEntry = {
  runItemId: string;
  companyName: string;
  missingInformation: string[];
  availableEvidence: string[];
  consultedSources: string[];
  verificationReason: string;
  budgetOrProviderLimits: string[];
  conceptBlocked: true;
};

type PipelineFunnel = {
  searchQueries: number;
  providerRequests: number;
  providerTelemetry?: {
    providerAttempts: number;
    websiteFetches: number;
    enrichmentProviderCalls: number;
  } | null;
  searchResultsReceived: number;
  uniqueCompanies: number;
  duplicateCompanies: number;
  enrichmentAttempts: number;
  eligibleProspects: number;
  needsEvidenceProspects: number;
  rejectedProspects: number;
  savedCompanies: number;
  concepts: number;
  providerUsed: string | null;
  providerFailoverCount: number;
};

export function EvidenceQueuePanel({ runId }: { runId: string }) {
  const [queue, setQueue] = useState<EvidenceQueueEntry[]>([]);
  const [funnel, setFunnel] = useState<PipelineFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ai-recruiter/runs/${runId}/evidence-queue`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Laden mislukt");
      setQueue(payload.queue ?? []);
      setFunnel(payload.pipelineFunnel ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Evidence queue laden…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {funnel ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline diagnostics (P0-R3)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <Metric label="Zoekresultaten" value={funnel.searchResultsReceived} />
            <Metric label="Unieke bedrijven" value={funnel.uniqueCompanies} />
            <Metric label="Duplicaten" value={funnel.duplicateCompanies} />
            <Metric label="Enrichment" value={funnel.enrichmentAttempts} />
            <Metric label="Eligible" value={funnel.eligibleProspects} />
            <Metric label="Needs evidence" value={funnel.needsEvidenceProspects} />
            <Metric label="Afgewezen" value={funnel.rejectedProspects} />
            <Metric label="Concepten" value={funnel.concepts} />
            {"providerTelemetry" in funnel && funnel.providerTelemetry ? (
              <Metric
                label="Provider-pogingen"
                value={funnel.providerTelemetry.providerAttempts ?? funnel.providerRequests}
              />
            ) : (
              <Metric label="Provider-pogingen (legacy)" value={funnel.providerRequests} />
            )}
            {funnel.providerUsed ? (
              <p className="col-span-full text-muted-foreground">
                Provider: {funnel.providerUsed}
                {funnel.providerFailoverCount > 0
                  ? ` · failover ×${funnel.providerFailoverCount}`
                  : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen prospects met needs_evidence in deze run.</p>
          ) : (
            queue.map((entry) => (
              <div key={entry.runItemId} className="rounded-lg border p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entry.companyName}</span>
                  <Badge variant="outline">needs_evidence</Badge>
                  <Badge variant="secondary">concept geblokkeerd</Badge>
                </div>
                <p className="text-muted-foreground">{entry.verificationReason}</p>
                {entry.missingInformation.length > 0 ? (
                  <p className="mt-2">
                    <span className="font-medium">Ontbreekt:</span> {entry.missingInformation.join(", ")}
                  </p>
                ) : null}
                {entry.availableEvidence.length > 0 ? (
                  <p className="mt-1">
                    <span className="font-medium">Bewijs:</span> {entry.availableEvidence.join(" · ")}
                  </p>
                ) : null}
                {entry.consultedSources.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bronnen: {entry.consultedSources.join(" · ")}
                  </p>
                ) : null}
                {entry.budgetOrProviderLimits.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Limiet: {entry.budgetOrProviderLimits.join(" · ")}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}