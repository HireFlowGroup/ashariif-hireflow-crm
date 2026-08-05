"use client";

import { BrainCircuit } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecruitmentIntelligenceAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { INSUFFICIENT_DATA } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import {
  opportunityTierEmoji,
  opportunityTierLabel,
} from "@/features/recruitment-intelligence/domain/recruitment-opportunity.helpers";
import { cn } from "@/lib/utils";

type Props = {
  analysis: RecruitmentIntelligenceAnalysis;
  generatedAt: string | null;
  isStale: boolean;
};

const ANALYSIS_QUESTIONS: Array<{ key: keyof RecruitmentIntelligenceAnalysis; title: string }> = [
  { key: "why_agency", title: "Waarom een recruitmentbureau inschakelen?" },
  { key: "likely_pain_points", title: "Waarschijnlijke pijn" },
  { key: "why_hireflow", title: "Waarom HireFlow?" },
  { key: "hard_to_fill_roles", title: "Moeilijk te vervullen functies" },
  { key: "urgency_rationale", title: "Hoe dringend is de behoefte?" },
  { key: "opportunity_chance_rationale", title: "Kans op een opdracht" },
  { key: "likely_decision_maker", title: "Beslisser met meeste mandaat" },
  { key: "opening_line", title: "Beste openingszin" },
  { key: "recommended_cta", title: "Beste CTA" },
];

function ScoreBadge({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">
        {value == null ? INSUFFICIENT_DATA : value}
      </p>
    </div>
  );
}

function OpportunityTierBadge({
  tier,
  score,
}: {
  tier: RecruitmentIntelligenceAnalysis["opportunity_tier"];
  score: number | null;
}) {
  if (!tier || score === null) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
        {INSUFFICIENT_DATA}
      </div>
    );
  }

  const tierClass =
    tier === "warm"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
      : tier === "interessant"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
        : "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300";

  return (
    <div className={cn("rounded-lg border px-4 py-3", tierClass)}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">Recruitment Opportunity Score</p>
      <div className="mt-1 flex items-center justify-center gap-2">
        <span className="text-2xl">{opportunityTierEmoji(tier)}</span>
        <span className="text-3xl font-bold tabular-nums">{score}</span>
        <Badge variant="outline" className="text-xs">
          {opportunityTierLabel(tier)}
        </Badge>
      </div>
    </div>
  );
}

function AnalysisBlock({ title, content }: { title: string; content: string }) {
  const isInsufficient = content === INSUFFICIENT_DATA || content === "Onvoldoende data.";

  return (
    <Card className={isInsufficient ? "border-dashed opacity-80" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed text-muted-foreground">{content}</CardContent>
    </Card>
  );
}

export function RecruitmentIntelligencePanel({ analysis, generatedAt, isStale }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <BrainCircuit className="size-4" />
          Recruitment Intelligence
        </h3>
        <div className="flex items-center gap-2">
          {isStale ? <Badge variant="outline" className="text-[10px]">Verouderd</Badge> : null}
          {generatedAt ? (
            <span className="text-[10px] text-muted-foreground">
              {new Date(generatedAt).toLocaleString("nl-NL")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <OpportunityTierBadge
          tier={analysis.opportunity_tier}
          score={analysis.recruitment_opportunity_score}
        />
        <ScoreBadge label="Urgentie" value={analysis.urgency_score} />
        <ScoreBadge label="Opportunity score" value={analysis.recruitment_opportunity_score} />
      </div>

      {analysis.company_summary !== INSUFFICIENT_DATA ? (
        <AnalysisBlock title="Bedrijfscontext" content={analysis.company_summary} />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {ANALYSIS_QUESTIONS.map(({ key, title }) => (
          <AnalysisBlock key={key} title={title} content={String(analysis[key])} />
        ))}
      </div>
    </section>
  );
}
