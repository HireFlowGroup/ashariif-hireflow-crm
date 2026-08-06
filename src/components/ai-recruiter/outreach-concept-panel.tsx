"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  SkipForward,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import { MAX_RECRUITMENT_OUTREACH_WORDS } from "@/features/ai-recruiter/domain/recruitment-outreach.types";
import {
  aiRecruiterFetchJson,
  buildOutreachMessagePath,
} from "@/lib/ai-recruiter/client-api";
import { cn } from "@/lib/utils";

type OutreachMessageDetail = {
  id: string;
  recipientName: string | null;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: string;
  personalizationData: {
    salutation?: string;
    cta?: string;
    warnings?: string[];
    personalizationFacts?: Array<{
      claim: string;
      sourceUrl: string | null;
      sourceType: string;
      confidence: number;
    }>;
    sourceEvidence?: Array<{
      claim: string;
      sourceUrl: string | null;
      sourceType: string;
      confidence: number;
    }>;
    model?: string;
    promptVersion?: string;
  };
};

type Props = {
  runId: string;
  item: AiRecruiterRunItem;
  onItemUpdated: (item: AiRecruiterRunItem) => void;
  onError: (message: string) => void;
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function OutreachConceptPanel({ runId, item, onItemUpdated, onError }: Props) {
  const [message, setMessage] = useState<OutreachMessageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendDisabled, setSendDisabled] = useState(true);

  const loadMessage = useCallback(async () => {
    if (!item.outreachMessageId) {
      setMessage(null);
      return;
    }
    setLoading(true);
    try {
      const [msgRes, verifyRes] = await Promise.all([
        aiRecruiterFetchJson<{ message: OutreachMessageDetail }>(
          "loadOutreachMessage",
          `/api/outreach/messages/${item.outreachMessageId}`,
        ),
        fetch("/api/outreach/email/verify"),
      ]);
      const verify = verifyRes.ok ? await verifyRes.json() : null;
      setSendDisabled(verify?.sendEnabled === false || verify?.draftOnly !== false);
      setMessage(msgRes.data.message);
      setSubject(msgRes.data.message.subject);
      setBody(msgRes.data.message.bodyText);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Concept laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [item.outreachMessageId, onError]);

  useEffect(() => {
    void loadMessage();
  }, [loadMessage]);

  const wordCount = useMemo(() => countWords(body), [body]);
  const facts = message?.personalizationData.personalizationFacts ?? [];
  const warnings = message?.personalizationData.warnings ?? [];
  const contact = (item.externalCompanyData as { contactDiscovery?: { selected?: { email?: string; jobTitle?: string; isGeneralMailbox?: boolean; selectionReason?: string } } })?.contactDiscovery?.selected;

  async function saveDraft() {
    if (!item.outreachMessageId) return;
    setAction("save");
    try {
      await aiRecruiterFetchJson(
        "saveDraft",
        `/api/outreach/messages/${item.outreachMessageId}`,
        {
          method: "PATCH",
          body: { subject, bodyText: body },
        },
      );
      await loadMessage();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Opslaan mislukt");
    } finally {
      setAction(null);
    }
  }

  async function approveDraft() {
    if (!item.outreachMessageId) return;
    setAction("approve");
    try {
      await aiRecruiterFetchJson(
        "approveDraft",
        buildOutreachMessagePath(item.outreachMessageId, "approve"),
        { method: "POST" },
      );
      await loadMessage();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Goedkeuren mislukt");
    } finally {
      setAction(null);
    }
  }

  async function rejectDraft() {
    if (!item.outreachMessageId) return;
    setAction("reject");
    try {
      await aiRecruiterFetchJson(
        "rejectDraft",
        buildOutreachMessagePath(item.outreachMessageId, "reject"),
        { method: "POST" },
      );
      await loadMessage();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Afwijzen mislukt");
    } finally {
      setAction(null);
    }
  }

  async function regenerateVariant(variant: string) {
    setAction(variant);
    try {
      const { data } = await aiRecruiterFetchJson<{ item: AiRecruiterRunItem }>(
        "regenerateDraft",
        `/api/ai-recruiter/runs/${runId}/items/${item.id}/regenerate-draft`,
        {
          method: "POST",
          body: { variant },
        },
      );
      onItemUpdated(data.item);
      await loadMessage();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Nieuwe versie mislukt");
    } finally {
      setAction(null);
    }
  }

  if (!item.outreachMessageId) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Conceptmail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nog geen concept voor deze prospect.</p>
          <Button
            className="mt-3"
            size="sm"
            disabled={action === "generate"}
            onClick={() => void regenerateVariant("default")}
          >
            {action === "generate" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Concept genereren
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading && !message) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Conceptmail</CardTitle>
          {message ? (
            <Badge variant="outline">{message.status}</Badge>
          ) : null}
        </div>
        {sendDisabled && message?.status === "approved" ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Goedgekeurd — verzending is uitgeschakeld.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto">
        <div className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Aan</span>
            <Input value={contact?.email ?? message?.recipientEmail ?? ""} readOnly className="mt-1" />
          </div>
          <div>
            <span className="text-muted-foreground">Naam contact</span>
            <Input value={message?.recipientName ?? "—"} readOnly className="mt-1" />
          </div>
          <div>
            <span className="text-muted-foreground">Functie</span>
            <Input value={contact?.jobTitle ?? "—"} readOnly className="mt-1" />
          </div>
          <div>
            <span className="text-muted-foreground">Onderwerp</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
          </div>
          <div>
            <span className="text-muted-foreground">Body</span>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="mt-1 font-mono text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={wordCount <= MAX_RECRUITMENT_OUTREACH_WORDS ? "secondary" : "destructive"}>
            {wordCount} woorden
          </Badge>
          {message?.personalizationData.model ? (
            <Badge variant="outline">{message.personalizationData.model}</Badge>
          ) : null}
          {message?.personalizationData.promptVersion ? (
            <Badge variant="outline">{message.personalizationData.promptVersion}</Badge>
          ) : null}
        </div>

        {facts.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Personalisatiefacts</p>
            {facts.map((fact) => (
              <div key={fact.claim} className="rounded border px-2 py-1 text-xs">
                <p>{fact.claim}</p>
                {fact.sourceUrl ? (
                  <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    bron
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-900 dark:text-amber-100">
            <div className="mb-1 flex items-center gap-1 font-medium">
              <AlertTriangle className="size-3" />
              Waarschuwingen
            </div>
            <ul className="list-inside list-disc">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {contact?.selectionReason ? (
          <p className="text-xs text-muted-foreground">
            Contactselectie: {contact.selectionReason}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
          <Button size="sm" variant="outline" disabled={!!action} onClick={() => void saveDraft()}>
            {action === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
            Opslaan
          </Button>
          <Button size="sm" variant="outline" disabled={!!action} onClick={() => void regenerateVariant("shorter")}>
            Korter
          </Button>
          <Button size="sm" variant="outline" disabled={!!action} onClick={() => void regenerateVariant("personal")}>
            Persoonlijker
          </Button>
          <Button size="sm" variant="outline" disabled={!!action} onClick={() => void regenerateVariant("formal")}>
            Formeler
          </Button>
          <Button size="sm" variant="outline" disabled={!!action} onClick={() => void regenerateVariant("direct")}>
            Directer
          </Button>
          <Button size="sm" variant="outline" disabled={!!action} onClick={() => void regenerateVariant("default")}>
            <RefreshCw className="size-4" />
            Nieuwe versie
          </Button>
          <Button size="sm" disabled={!!action} onClick={() => void approveDraft()}>
            {action === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Goedkeuren
          </Button>
          <Button size="sm" variant="destructive" disabled={!!action} onClick={() => void rejectDraft()}>
            {action === "reject" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            Afwijzen
          </Button>
          <Button size="sm" variant="ghost" disabled>
            <SkipForward className="size-4" />
            Overslaan
          </Button>
          {!sendDisabled ? (
            <Button size="sm" variant="secondary" disabled title="Verzending vereist expliciete bevestiging">
              <Send className="size-4" />
              Verzenden
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
