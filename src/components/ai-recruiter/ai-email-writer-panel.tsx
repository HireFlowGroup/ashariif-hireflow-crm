"use client";

import { useState } from "react";
import { Mail, Send, Check, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiEmailWriterDraft, AiEmailWriterStyle } from "@/features/ai-email-writer/domain/ai-email-writer.types";
import { MAX_EMAIL_WORDS } from "@/features/ai-email-writer/domain/ai-email-writer.types";
import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import type { RecruitmentIntelligenceAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import {
  aiRecruiterFetchJson,
  buildOutreachMessagePath,
} from "@/lib/ai-recruiter/client-api";

type Props = {
  runId: string;
  item: AiRecruiterRunItem;
  draft: AiEmailWriterDraft | null;
  draftStatus: string | null;
  hasAnalysis: boolean;
  onDraftUpdated: (draft: AiEmailWriterDraft) => void;
  onError: (message: string) => void;
};

const SECTIONS: Array<{ key: keyof AiEmailWriterDraft; label: string }> = [
  { key: "personalIntroduction", label: "Persoonlijke introductie" },
  { key: "observedSituation", label: "Waargenomen situatie" },
  { key: "whyHireFlow", label: "Waarom HireFlow" },
  { key: "callToAction", label: "Call to action" },
  { key: "closing", label: "Afsluiting" },
];

export function AiEmailWriterPanel({
  runId,
  item,
  draft,
  draftStatus,
  hasAnalysis,
  onDraftUpdated,
  onError,
}: Props) {
  const [loading, setLoading] = useState<AiEmailWriterStyle | "approve" | "send" | null>(null);
  const [localDraft, setLocalDraft] = useState<AiEmailWriterDraft | null>(draft);

  const activeDraft = localDraft ?? draft;

  async function generate(style: AiEmailWriterStyle) {
    setLoading(style);
    try {
      const { data } = await aiRecruiterFetchJson<{ draft: AiEmailWriterDraft }>(
        "emailWriter",
        `/api/ai-recruiter/runs/${runId}/items/${item.id}/email-writer`,
        {
          method: "POST",
          body: {
            style,
            current: style !== "new_version" ? activeDraft : undefined,
          },
          expectedStatuses: [200],
        },
      );
      setLocalDraft(data.draft);
      onDraftUpdated(data.draft);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "E-mail genereren mislukt");
    } finally {
      setLoading(null);
    }
  }

  async function approveDraft() {
    if (!item.outreachMessageId) return;
    setLoading("approve");
    try {
      await aiRecruiterFetchJson(
        "approveDraft",
        buildOutreachMessagePath(item.outreachMessageId, "approve"),
        { method: "POST", expectedStatuses: [200] },
      );
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Goedkeuren mislukt");
    } finally {
      setLoading(null);
    }
  }

  async function sendDraft() {
    if (!item.outreachMessageId) return;
    setLoading("send");
    try {
      await aiRecruiterFetchJson(
        "sendDraft",
        buildOutreachMessagePath(item.outreachMessageId, "send"),
        { method: "POST", body: { confirmed: true }, expectedStatuses: [200] },
      );
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Verzenden mislukt — goedkeur eerst het concept.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Mail className="size-4" />
          AI Email Writer
        </h3>
        {activeDraft ? (
          <Badge variant="outline" className="text-[10px]">
            {activeDraft.wordCount}/{MAX_EMAIL_WORDS} woorden
          </Badge>
        ) : null}
      </div>

      {!hasAnalysis ? (
        <p className="text-sm text-muted-foreground">
          Genereer eerst een AI Analyse — de e-mailwriter gebruikt uitsluitend feiten uit die analyse.
        </p>
      ) : null}

      {!activeDraft ? (
        <Button
          type="button"
          size="sm"
          disabled={!hasAnalysis || loading !== null || !item.recipientEmail}
          onClick={() => void generate("new_version")}
        >
          {loading === "new_version" ? <Loader2 className="size-4 animate-spin" /> : null}
          E-mail genereren
        </Button>
      ) : (
        <>
          <div className="rounded-lg border bg-muted/10 px-4 py-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Onderwerp: </span>
              <span className="font-medium">{activeDraft.subject}</span>
            </p>
            {draftStatus ? (
              <Badge variant="outline" className="mt-2 text-[10px]">{draftStatus}</Badge>
            ) : null}
          </div>

          <div className="grid gap-3">
            {SECTIONS.map(({ key, label }) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{label}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {activeDraft[key] as string}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["new_version", "Nieuwe versie"],
                ["shorter", "Korter"],
                ["formal", "Formeler"],
                ["personal", "Persoonlijker"],
              ] as const
            ).map(([style, label]) => (
              <Button
                key={style}
                type="button"
                size="sm"
                variant="outline"
                disabled={loading !== null}
                onClick={() => void generate(style)}
              >
                {loading === style ? <Loader2 className="size-4 animate-spin" /> : null}
                {label}
              </Button>
            ))}

            {item.outreachMessageId ? (
              <>
                <Button type="button" size="sm" disabled={loading !== null} onClick={() => void approveDraft()}>
                  {loading === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Goedkeuren
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={loading !== null}
                  onClick={() => void sendDraft()}
                >
                  {loading === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Verzenden
                </Button>
              </>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
