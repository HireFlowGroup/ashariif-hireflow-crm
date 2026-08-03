"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarClock,
  Loader2,
  Mail,
  Phone,
  Sparkles,
  Target,
  TrendingUp,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyOutreachIntelligence } from "@/features/company-intelligence/domain/company-page.types";
import type { OutreachIntelligenceRecord } from "@/features/outreach-intelligence/domain/types";
import { cn } from "@/lib/utils";

function mapToPanel(record: OutreachIntelligenceRecord): CompanyOutreachIntelligence {
  return {
    id: record.id,
    outreachId: record.outreachId,
    recommendedContactId: record.recommendedContactId,
    recommendedContactName: record.recommendedContactName,
    recommendedContactRole: record.recommendedContactRole,
    contactScore: record.contactScore,
    contactReason: record.contactReason,
    recommendedChannel: record.recommendedChannel,
    channelScores: record.channelScores,
    channelReason: record.channelReason,
    recommendedMomentAt: record.recommendedMomentAt,
    recommendedMomentLabel: record.recommendedMomentLabel,
    timingReason: record.timingReason,
    outreachScore: record.outreachScore,
    responseProbability: record.responseProbability,
    draftSubject: record.draftSubject,
    draftBody: record.draftBody,
    followUpSubject: record.followUpSubject,
    followUpBody: record.followUpBody,
    followUpScheduledAt: record.followUpScheduledAt,
    model: record.model,
    computedAt: record.computedAt,
  };
}

const CHANNEL_LABELS = {
  email: "E-mail",
  linkedin: "LinkedIn",
  phone: "Telefoon",
} as const;

const CHANNEL_ICONS = {
  email: Mail,
  linkedin: Sparkles,
  phone: Phone,
} as const;

type CompanyOutreachIntelligencePanelProps = {
  companyId: string;
  intelligence: CompanyOutreachIntelligence | null;
};

function ScoreRing({ value, label }: { value: number; label: string }) {
  const color =
    value >= 75 ? "text-emerald-600" : value >= 50 ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-muted/20 p-4 text-center">
      <p className={cn("text-3xl font-bold tabular-nums", color)}>{value}%</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ChannelBar({ label, score, active }: { label: string; score: number; active: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={active ? "font-medium text-foreground" : "text-muted-foreground"}>
          {label}
        </span>
        <span className="tabular-nums">{score}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", active ? "bg-violet-500" : "bg-muted-foreground/30")}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function CompanyOutreachIntelligencePanel({
  companyId,
  intelligence,
}: CompanyOutreachIntelligencePanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(intelligence);

  async function generate() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/outreach-intelligence`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        intelligence?: OutreachIntelligenceRecord;
        error?: string;
      };

      if (!response.ok || !body.intelligence) {
        throw new Error(body.error ?? "Genereren mislukt.");
      }

      setLocal(mapToPanel(body.intelligence));
      router.refresh();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Genereren mislukt.");
    } finally {
      setLoading(false);
    }
  }

  const data = local;
  const ChannelIcon = data ? CHANNEL_ICONS[data.recommendedChannel] : Sparkles;

  return (
    <Card className="h-full border-violet-500/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5 text-violet-500" />
              Outreach Intelligence
            </CardTitle>
            <CardDescription>
              AI-aanbevelingen voor contact, kanaal, timing en conceptmail
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => void generate()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {data ? "Vernieuwen" : "Genereer outreach"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!data ? (
          <p className="text-sm text-muted-foreground">
            Nog geen outreach intelligence. Genereer een aanbeveling op basis van contacten, signalen en
            lead score.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreRing value={data.outreachScore} label="Outreach score" />
              <ScoreRing value={data.responseProbability} label="Response prediction" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="size-4 text-violet-500" />
                  Beste contactpersoon
                </div>
                <p className="text-base font-semibold">
                  {data.recommendedContactName ?? "Geen contact gevonden"}
                </p>
                {data.recommendedContactRole ? (
                  <p className="text-sm text-muted-foreground">{data.recommendedContactRole}</p>
                ) : null}
                <Badge variant="secondary">Contact score {data.contactScore}%</Badge>
                {data.contactReason ? (
                  <p className="text-xs text-muted-foreground">{data.contactReason}</p>
                ) : null}
              </div>

              <div className="space-y-2 rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="size-4 text-violet-500" />
                  Beste moment
                </div>
                <p className="text-base font-semibold">
                  {data.recommendedMomentLabel ?? "Niet berekend"}
                </p>
                {data.timingReason ? (
                  <p className="text-xs text-muted-foreground">{data.timingReason}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ChannelIcon className="size-4 text-violet-500" />
                Beste kanaal: {CHANNEL_LABELS[data.recommendedChannel]}
              </div>
              {data.channelReason ? (
                <p className="text-xs text-muted-foreground">{data.channelReason}</p>
              ) : null}
              <div className="space-y-2 pt-1">
                <ChannelBar
                  label="E-mail"
                  score={data.channelScores.email}
                  active={data.recommendedChannel === "email"}
                />
                <ChannelBar
                  label="LinkedIn"
                  score={data.channelScores.linkedin}
                  active={data.recommendedChannel === "linkedin"}
                />
                <ChannelBar
                  label="Telefoon"
                  score={data.channelScores.phone}
                  active={data.recommendedChannel === "phone"}
                />
              </div>
            </div>

            {data.draftSubject || data.draftBody ? (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="size-4" />
                  Conceptmail
                </div>
                {data.draftSubject ? (
                  <p className="text-sm font-medium">Onderwerp: {data.draftSubject}</p>
                ) : null}
                {data.draftBody ? (
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">
                    {data.draftBody}
                  </pre>
                ) : null}
              </div>
            ) : null}

            {data.followUpSubject || data.followUpBody ? (
              <div className="space-y-2 rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="size-4" />
                  Automatische follow-up
                </div>
                {data.followUpScheduledAt ? (
                  <p className="text-xs text-muted-foreground">
                    Gepland:{" "}
                    {new Date(data.followUpScheduledAt).toLocaleString("nl-NL", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
                {data.followUpSubject ? (
                  <p className="text-sm font-medium">Onderwerp: {data.followUpSubject}</p>
                ) : null}
                {data.followUpBody ? (
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">
                    {data.followUpBody}
                  </pre>
                ) : null}
              </div>
            ) : null}

            {data.model ? (
              <p className="text-[10px] text-muted-foreground">
                Model: {data.model} · Berekend{" "}
                {new Date(data.computedAt).toLocaleString("nl-NL")}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
