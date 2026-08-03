"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";

import { ContactFinderDialog } from "@/components/companies/contact-finder-dialog";
import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CompanyPageData } from "@/features/company-intelligence/domain/company-page.types";
import { priorityColorClass } from "@/features/lead-scoring/domain/lead-score.types";
import { cn } from "@/lib/utils";

type CompanyPageHeroProps = {
  data: CompanyPageData;
};

export function CompanyPageHero({ data }: CompanyPageHeroProps) {
  const router = useRouter();
  const [contactFinderOpen, setContactFinderOpen] = useState(false);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachMessage, setOutreachMessage] = useState<string | null>(null);

  const { company, intelligence } = data;

  async function generateOutreachIntelligence() {
    setOutreachLoading(true);
    setOutreachMessage(null);

    try {
      const response = await fetch(`/api/companies/${company.id}/outreach-intelligence`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Outreach intelligence mislukt.");
      }

      setOutreachMessage("Outreach intelligence gegenereerd.");
      router.refresh();
    } catch (error) {
      setOutreachMessage(error instanceof Error ? error.message : "Outreach intelligence mislukt.");
    } finally {
      setOutreachLoading(false);
    }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-500/10 via-background to-sky-500/5 p-6 md:p-8">
        <div className="absolute -right-8 -top-8 size-40 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/companies"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Bedrijven
            </Link>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{company.name}</h1>
                <CompanyStatusBadge status={company.status} />
                {intelligence.currentPriority ? (
                  <Badge variant="secondary" className={cn("font-semibold", priorityColorClass(intelligence.currentPriority))}>
                    Priority {intelligence.currentPriority}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {company.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {company.city}
                    {company.region ? `, ${company.region}` : ""}
                  </span>
                ) : null}
                {company.sector ? <span>{company.sector}</span> : null}
                {company.domain ? <span>{company.domain}</span> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="flex items-center gap-4 rounded-xl border bg-background/80 px-5 py-4 shadow-sm backdrop-blur">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Leadscore</p>
                <p className="text-4xl font-bold tabular-nums">{intelligence.currentScore ?? "—"}</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Intensity</p>
                <p className="text-2xl font-semibold tabular-nums">{intelligence.hiringIntensity}</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Signals</p>
                <p className="text-2xl font-semibold tabular-nums">{intelligence.signalCount}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactFinderOpen(true)}
              >
                <Users className="size-4" />
                Zoek contacten
              </Button>
              <Button size="sm" disabled={outreachLoading} onClick={() => void generateOutreachIntelligence()}>
                <Sparkles className="size-4" />
                {outreachLoading ? "Bezig…" : "Outreach intelligence"}
              </Button>
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  <ExternalLink className="size-4" />
                  Website
                </a>
              ) : null}
            </div>

            {outreachMessage ? (
              <p className="max-w-xs text-right text-xs text-muted-foreground">{outreachMessage}</p>
            ) : null}
          </div>
        </div>
      </div>

      <ContactFinderDialog
        open={contactFinderOpen}
        companyId={company.id as string}
        companyName={company.name}
        onOpenChange={setContactFinderOpen}
        onCompleted={() => router.refresh()}
      />
    </>
  );
}

export function CompanyAiSummaryCard({ data }: { data: CompanyPageData }) {
  const summary = data.intelligence.aiSummary ?? data.scoreExplanation;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-violet-500" />
        <h2 className="text-sm font-semibold">AI Samenvatting</h2>
      </div>
      {summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nog geen AI samenvatting. Run een intelligence scan om inzichten te genereren.
        </p>
      )}
      {data.intelligence.scoreReason && !data.scoreExplanation?.includes(data.intelligence.scoreReason) ? (
        <p className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          {data.intelligence.scoreReason}
        </p>
      ) : null}
    </div>
  );
}
