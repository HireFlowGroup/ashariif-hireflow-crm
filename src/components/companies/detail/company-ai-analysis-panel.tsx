"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronDown,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useCompanyAnalysisStream } from "@/components/companies/detail/use-company-analysis-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COMPANY_ANALYSIS_SECTION_LABELS,
  type CompanyAnalysisSectionKey,
} from "@/features/company-ai-analysis/domain/analysis.types";
import { cn } from "@/lib/utils";

type CompanyAiAnalysisPanelProps = {
  companyId: string;
  className?: string;
};

const SECTION_ICONS: Record<CompanyAnalysisSectionKey, typeof Sparkles> = {
  summary: Sparkles,
  recruitmentSituation: Briefcase,
  recruitmentPotential: Target,
  recruitmentPotentialMotivation: Megaphone,
  growth: TrendingUp,
  challenges: AlertTriangle,
  outreachAdvice: Megaphone,
  likelyDecisionMaker: UserRound,
  suitableRoles: Target,
  likelyAts: Building2,
  competitors: Building2,
  topHiringSignal: Sparkles,
};

const SECTION_ORDER: CompanyAnalysisSectionKey[] = [
  "summary",
  "recruitmentPotential",
  "recruitmentPotentialMotivation",
  "recruitmentSituation",
  "growth",
  "challenges",
  "outreachAdvice",
  "likelyDecisionMaker",
  "suitableRoles",
  "likelyAts",
  "competitors",
  "topHiringSignal",
];

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

export function CompanyAiAnalysisPanel({ companyId, className }: CompanyAiAnalysisPanelProps) {
  const [expanded, setExpanded] = useState<Record<CompanyAnalysisSectionKey, boolean>>({
    summary: true,
    recruitmentSituation: false,
    recruitmentPotential: true,
    recruitmentPotentialMotivation: true,
    growth: false,
    challenges: false,
    outreachAdvice: true,
    likelyDecisionMaker: false,
    suitableRoles: false,
    likelyAts: false,
    competitors: false,
    topHiringSignal: true,
  });

  const { data, isConnected, isLoading, isRegenerating, errorMessage, regenerate } =
    useCompanyAnalysisStream({ companyId });

  const analysis = data?.analysis;
  const isStale = data?.isStale ?? false;

  function toggleSection(key: CompanyAnalysisSectionKey) {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="space-y-4 border-b bg-muted/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-violet-500" />
              AI Company Analysis
            </CardTitle>
            <CardDescription>
              Automatische analyse op basis van HireFlow-data — geen externe bronnen
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={isConnected ? "default" : "outline"}
              className="gap-1 text-[10px] font-normal"
            >
              {isConnected ? (
                <>
                  <Wifi className="size-3" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="size-3" />
                  Offline
                </>
              )}
            </Badge>
            {isStale ? (
              <Badge variant="secondary" className="text-[10px]">
                Vernieuwing…
              </Badge>
            ) : null}
            {analysis?.generatedAt ? (
              <span className="text-[10px] text-muted-foreground">
                {formatRelative(analysis.generatedAt)}
              </span>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={isRegenerating}
              onClick={() => void regenerate()}
            >
              {isRegenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Vernieuwen
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {errorMessage ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {isLoading && !analysis ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : !analysis ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nog geen analyse beschikbaar. Run een intelligence scan of enrichment om te starten.
          </div>
        ) : (
          <div className="space-y-2">
            {SECTION_ORDER.map((key) => {
              const Icon = SECTION_ICONS[key];
              const isOpen = expanded[key];
              const content = analysis.sections[key];

              return (
                <section
                  key={key}
                  className="overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/20"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => toggleSection(key)}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4 shrink-0 text-primary" />
                      {COMPANY_ANALYSIS_SECTION_LABELS[key]}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen ? "rotate-180" : "",
                      )}
                    />
                  </button>
                  {isOpen ? (
                    <div className="border-t px-4 py-3">
                      {key === "recruitmentPotential" ? (
                        <Badge
                          variant={
                            content === "HIGH"
                              ? "default"
                              : content === "MEDIUM"
                                ? "secondary"
                                : "outline"
                          }
                          className="mb-2"
                        >
                          {content}
                        </Badge>
                      ) : null}
                      <p className="text-sm leading-relaxed text-muted-foreground">{content}</p>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}

        {analysis?.model ? (
          <p className="mt-4 text-center text-[10px] text-muted-foreground">
            Model: {analysis.model} · alleen HireFlow-data
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
