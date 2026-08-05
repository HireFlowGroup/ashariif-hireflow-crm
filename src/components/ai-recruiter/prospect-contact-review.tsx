"use client";

import { useState } from "react";
import { Loader2, RefreshCw, UserPlus, Ban, XCircle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import { aiRecruiterFetchJson } from "@/lib/ai-recruiter/client-api";
import { cn } from "@/lib/utils";

type Props = {
  runId: string;
  item: AiRecruiterRunItem;
  onUpdated: (item: AiRecruiterRunItem) => void;
  onError: (message: string) => void;
};

function reliabilityBadgeClass(level: string | null | undefined): string {
  switch (level) {
    case "high":
      return "border-emerald-500/40 text-emerald-700 bg-emerald-500/5";
    case "medium":
      return "border-amber-500/40 text-amber-800 bg-amber-500/5";
    default:
      return "border-muted-foreground/30 text-muted-foreground";
  }
}

export function ProspectContactReview({ runId, item, onUpdated, onError }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");

  async function runAction(body: Record<string, unknown>, key: string) {
    setLoading(key);
    try {
      const { data } = await aiRecruiterFetchJson<{ item: AiRecruiterRunItem }>(
        "contactAction",
        `/api/ai-recruiter/runs/${runId}/items/${item.id}/contact`,
        { method: "POST", body, expectedStatuses: [200] },
      );
      onUpdated(data.item);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Actie mislukt");
    } finally {
      setLoading(null);
    }
  }

  const hasContact = Boolean(item.recipientEmail && item.selectedContactId);
  const isBlocked = item.stage === "blocked_missing_contact" || item.stage === "contact_lookup_failed";

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-md border bg-muted/20 p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Intelligence</p>
        <p><span className="text-muted-foreground">Naam:</span> {item.contactName ?? "—"}</p>
        <p><span className="text-muted-foreground">Functie:</span> {item.contactJobTitle ?? item.contactRoleLabel ?? "—"}</p>
        <p><span className="text-muted-foreground">E-mail:</span> {item.recipientEmail ?? "—"}</p>
        {item.contactLinkedinUrl ? (
          <p className="flex items-center gap-1">
            <span className="text-muted-foreground">LinkedIn:</span>
            <a
              href={item.contactLinkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Profiel <ExternalLink className="size-3" />
            </a>
          </p>
        ) : (
          <p><span className="text-muted-foreground">LinkedIn:</span> —</p>
        )}

        <div className="rounded border px-2 py-1.5 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Betrouwbaarheid:</span>
            <Badge
              variant="outline"
              className={cn("text-[10px]", reliabilityBadgeClass(item.contactReliabilityLevel))}
            >
              {item.contactReliabilityLevel ?? "onbekend"}
              {item.contactReliabilityScore != null ? ` · ${item.contactReliabilityScore}/100` : ""}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.contactReliabilitySummary ?? "Geen betrouwbaarheidsrapport — contact opnieuw zoeken of handmatig toevoegen."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {item.contactVerificationStatus ? (
            <Badge variant="outline">{item.contactVerificationStatus}</Badge>
          ) : null}
          {item.contactSourceType ? (
            <Badge variant="outline">{item.contactSourceType}</Badge>
          ) : null}
          {item.contactRelevanceScore != null ? (
            <Badge variant="outline">match {item.contactRelevanceScore}</Badge>
          ) : null}
          {item.contactRoleLabel ? (
            <Badge variant="outline">{item.contactRoleLabel}</Badge>
          ) : null}
        </div>
        {item.contactSelectionReason ? (
          <p className="text-xs text-muted-foreground pt-1">{item.contactSelectionReason}</p>
        ) : null}
      </div>

      {isBlocked && item.contactDiscoveryError ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-800 dark:text-amber-200 text-xs">
          {item.contactDiscoveryError}
        </div>
      ) : null}

      {(item.contactAlternatives?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Alternatieve contacten</p>
          {item.contactAlternatives!.map((alt) => (
            <div key={alt.email} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
              <div>
                <p className="font-medium">{alt.recipientName ?? alt.email}</p>
                <p className="text-xs text-muted-foreground">
                  {alt.roleLabel ?? alt.jobTitle ?? "—"} · {alt.sourceType} · {alt.relevanceScore}
                </p>
                {alt.reliabilitySummary ? (
                  <p className="text-[10px] text-muted-foreground">{alt.reliabilitySummary}</p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading !== null}
                onClick={() => void runAction({ action: "select", email: alt.email }, alt.email)}
              >
                Selecteer
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={() => void runAction({ action: "retry" }, "retry")}
        >
          {loading === "retry" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Opnieuw zoeken
        </Button>

        {item.recipientEmail ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading !== null}
              onClick={() => void runAction({ action: "mark-invalid", email: item.recipientEmail }, "invalid")}
            >
              <XCircle className="size-4" /> Markeer ongeldig
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading !== null}
              onClick={() => void runAction({ action: "block", email: item.recipientEmail }, "block")}
            >
              <Ban className="size-4" /> Blokkeer adres
            </Button>
          </>
        ) : null}
      </div>

      {!hasContact ? (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Geen beslisser gevonden. Contact Intelligence zoekt eerst HR Manager / Recruiter / TA, daarna fallback recruitment@ → hr@ → jobs@ → info@.
          </p>
          <input
            className="w-full rounded-md border bg-background px-2 py-1 text-xs"
            placeholder="E-mailadres"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
          />
          <input
            className="w-full rounded-md border bg-background px-2 py-1 text-xs"
            placeholder="Naam (optioneel)"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={!manualEmail.trim() || loading !== null}
            onClick={() => {
              const [firstName, ...rest] = manualName.trim().split(/\s+/);
              void runAction(
                {
                  action: "add-manual",
                  email: manualEmail.trim(),
                  firstName: firstName || undefined,
                  lastName: rest.join(" ") || undefined,
                },
                "manual",
              );
            }}
          >
            <UserPlus className="size-4" /> Contact handmatig toevoegen
          </Button>
        </div>
      ) : null}
    </div>
  );
}
