"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Sparkles,
  Voicemail,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OUTREACH_WRITING_STYLE_LABELS,
  type OutreachGeneratorRecord,
  type OutreachGeneratorResponse,
  type OutreachWritingStyle,
} from "@/features/outreach-generator/domain/generator.types";
import { cn } from "@/lib/utils";

type CompanyOutreachGeneratorProps = {
  companyId: string;
  className?: string;
};

type AssetKey =
  | "coldEmail"
  | "linkedinMessage"
  | "callScript"
  | "voicemail"
  | "followUp1"
  | "followUp2"
  | "followUp3";

const ASSET_CONFIG: Array<{
  key: AssetKey;
  label: string;
  icon: typeof Mail;
}> = [
  { key: "coldEmail", label: "Cold email", icon: Mail },
  { key: "linkedinMessage", label: "LinkedIn bericht", icon: MessageSquare },
  { key: "callScript", label: "Belscript", icon: Phone },
  { key: "voicemail", label: "Voicemail", icon: Voicemail },
  { key: "followUp1", label: "Follow-up 1", icon: Mail },
  { key: "followUp2", label: "Follow-up 2", icon: Mail },
  { key: "followUp3", label: "Follow-up 3", icon: Mail },
];

const STYLES = Object.entries(OUTREACH_WRITING_STYLE_LABELS) as Array<
  [OutreachWritingStyle, string]
>;

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function SignalBadges({ signals }: { signals: string[] }) {
  if (signals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((signal) => (
        <Badge key={signal} variant="secondary" className="text-[10px] font-normal">
          {signal}
        </Badge>
      ))}
    </div>
  );
}

function AssetBlock({
  title,
  icon: Icon,
  subject,
  body,
  signals,
  defaultOpen,
}: {
  title: string;
  icon: typeof Mail;
  subject?: string | null;
  body: string;
  signals: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = subject ? `Onderwerp: ${subject}\n\n${body}` : body;
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-3 border-t px-4 py-3">
          <SignalBadges signals={signals} />

          {subject ? (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Onderwerp
              </p>
              <p className="mt-1 text-sm font-medium">{subject}</p>
            </div>
          ) : null}

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Tekst
            </p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed">{body}</pre>
          </div>

          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
            <Copy className="size-3.5" />
            {copied ? "Gekopieerd" : "Kopiëren"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function renderAssetContent(generation: OutreachGeneratorRecord, key: AssetKey) {
  const content = generation.content[key];

  if (key === "callScript") {
    const script = generation.content.callScript;
    const body = [
      `Opening: ${script.opening}`,
      "",
      `Discovery: ${script.discovery}`,
      "",
      `Waarde: ${script.valueProposition}`,
      "",
      `Afsluiting: ${script.close}`,
    ].join("\n");

    return {
      subject: null,
      body,
      signals: script.referencedSignals,
    };
  }

  return {
    subject: "subject" in content && "body" in content ? content.subject : null,
    body: "body" in content ? content.body : "",
    signals: content.referencedSignals,
  };
}

export function CompanyOutreachGenerator({ companyId, className }: CompanyOutreachGeneratorProps) {
  const [style, setStyle] = useState<OutreachWritingStyle>("consultative");
  const [data, setData] = useState<OutreachGeneratorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selectedStyle: OutreachWritingStyle) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/companies/${companyId}/outreach-generator?style=${selectedStyle}`,
      );
      const body = (await response.json()) as OutreachGeneratorResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Laden mislukt");
      }

      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load(style);
  }, [load, style]);

  async function generate() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/outreach-generator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, force: true }),
      });
      const body = (await response.json()) as {
        generation?: OutreachGeneratorRecord;
        error?: string;
      };

      if (!response.ok || !body.generation) {
        throw new Error(body.error ?? "Genereren mislukt");
      }

      setData((current) => ({
        generation: body.generation!,
        availableStyles: current?.availableStyles ?? [],
      }));
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Genereren mislukt");
    } finally {
      setGenerating(false);
    }
  }

  const generation = data?.generation;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="space-y-4 border-b bg-muted/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-violet-500" />
              Outreach Generator
            </CardTitle>
            <CardDescription>
              AI-gegenereerde outreach op basis van hiring signals — geen generieke sales teksten
            </CardDescription>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={generate}
            disabled={generating || loading}
            className="gap-1.5"
          >
            {generating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Genereren…
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                {generation ? "Opnieuw genereren" : "Genereren"}
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STYLES.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={style === value ? "default" : "outline"}
              onClick={() => setStyle(value)}
              disabled={loading || generating}
            >
              {label}
            </Button>
          ))}
        </div>

        {generation ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Gegenereerd {formatRelative(generation.generatedAt)}</span>
            {generation.contactName ? (
              <>
                <span>·</span>
                <span>Contact: {generation.contactName}</span>
              </>
            ) : null}
            {generation.model ? (
              <>
                <span>·</span>
                <span>{generation.model}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Outreach laden…
          </div>
        ) : !generation ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <p className="text-sm font-medium">Nog geen outreach voor deze schrijfstijl</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Genereer een volledig pakket: cold email, LinkedIn, belscript, voicemail en 3 follow-ups
            </p>
            <Button type="button" size="sm" className="mt-4" onClick={generate} disabled={generating}>
              Outreach genereren
            </Button>
          </div>
        ) : (
          ASSET_CONFIG.map((asset, index) => {
            const rendered = renderAssetContent(generation, asset.key);
            return (
              <AssetBlock
                key={asset.key}
                title={asset.label}
                icon={asset.icon}
                subject={rendered.subject}
                body={rendered.body}
                signals={rendered.signals}
                defaultOpen={index === 0}
              />
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
