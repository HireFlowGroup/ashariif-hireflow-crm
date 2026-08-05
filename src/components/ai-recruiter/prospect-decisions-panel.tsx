"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProspectDecisionRow = {
  id: string;
  run_item_id: string;
  company_name: string;
  vacancy_title: string | null;
  contact_type: string | null;
  contact_email: string | null;
  deterministic_score: number | null;
  eligibility_status: string;
  concept_status: string;
  accepted_rules: string[];
  rejected_rules: string[];
  final_reason: string;
  reason_code: string | null;
  manual_eligibility_override?: boolean;
};

type ProspectDecisionsPanelProps = {
  runId: string;
  threshold?: number;
  onDraftCreated?: () => void;
};

export function ProspectDecisionsPanel({
  runId,
  threshold = 30,
  onDraftCreated,
}: ProspectDecisionsPanelProps) {
  const [decisions, setDecisions] = useState<ProspectDecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionItemId, setActionItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ai-recruiter/runs/${runId}/prospect-decisions`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Laden mislukt");
      setDecisions(payload.decisions ?? []);
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

  const handleManualOverride = async (itemId: string) => {
    setActionItemId(itemId);
    try {
      const response = await fetch(
        `/api/ai-recruiter/runs/${runId}/items/${itemId}/manual-eligibility`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Override mislukt");
      await load();
      onDraftCreated?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Override mislukt");
    } finally {
      setActionItemId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Prospectbeslissingen laden…</p>;
  }

  if (error && decisions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Prospectbeslissingen niet beschikbaar ({error}). Voer eerst `supabase db push` uit
          voor de audit-tabel.
        </CardContent>
      </Card>
    );
  }

  if (decisions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Nog geen prospectbeslissingen opgeslagen voor deze run.
        </CardContent>
      </Card>
    );
  }

  const eligible = decisions.filter(
    (d) => d.eligibility_status === "eligible" || d.eligibility_status === "manual_override",
  );
  const averageScore =
    decisions.length > 0
      ? Math.round(
          decisions.reduce((sum, d) => sum + (d.deterministic_score ?? 0), 0) / decisions.length,
        )
      : 0;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-4 text-sm">
        <div className="rounded-lg border px-3 py-2">
          <p className="text-muted-foreground">Beoordeeld</p>
          <p className="text-xl font-semibold">{decisions.length}</p>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <p className="text-muted-foreground">Eligible</p>
          <p className="text-xl font-semibold">{eligible.length}</p>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <p className="text-muted-foreground">Gem. score</p>
          <p className="text-xl font-semibold">{averageScore}</p>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <p className="text-muted-foreground">Drempel</p>
          <p className="text-xl font-semibold">{threshold}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prospectbeslissingen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {decisions.map((decision) => (
            <div key={decision.id} className="rounded-lg border p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{decision.company_name}</span>
                <Badge
                  variant={
                    decision.eligibility_status === "eligible"
                    || decision.eligibility_status === "manual_override"
                      ? "default"
                      : "secondary"
                  }
                >
                  {decision.eligibility_status}
                </Badge>
                <Badge variant="outline">score {decision.deterministic_score ?? "—"}</Badge>
                <Badge variant="outline">{decision.concept_status}</Badge>
              </div>
              {decision.vacancy_title ? (
                <p className="text-muted-foreground">Vacature: {decision.vacancy_title}</p>
              ) : null}
              {decision.contact_email ? (
                <p className="text-muted-foreground">
                  Contact: {decision.contact_type ?? "onbekend"} · {decision.contact_email}
                </p>
              ) : null}
              <p>{decision.final_reason}</p>
              {decision.accepted_rules.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Accepted: {decision.accepted_rules.join(", ")}
                </p>
              ) : null}
              {decision.rejected_rules.length > 0 ? (
                <p className="text-xs text-destructive/80">
                  Rejected: {decision.rejected_rules.join(", ")}
                </p>
              ) : null}
              {decision.eligibility_status === "ineligible"
              && decision.concept_status !== "created" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionItemId === decision.run_item_id}
                  onClick={() => void handleManualOverride(decision.run_item_id)}
                >
                  {actionItemId === decision.run_item_id ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Handmatig toelaten + concept
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
