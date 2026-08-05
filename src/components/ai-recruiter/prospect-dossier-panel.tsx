"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { AiEmailWriterPanel } from "@/components/ai-recruiter/ai-email-writer-panel";
import { AiEmailWriterPanel } from "@/components/ai-recruiter/ai-email-writer-panel";
import { ProspectContactReview } from "@/components/ai-recruiter/prospect-contact-review";
import { RecruitmentIntelligencePanel } from "@/components/ai-recruiter/recruitment-intelligence-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ProspectDossier } from "@/features/ai-recruiter/domain/prospect-dossier.types";
import type { AiEmailWriterDraft } from "@/features/ai-email-writer/domain/ai-email-writer.types";
import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import { aiRecruiterFetchJson } from "@/lib/ai-recruiter/client-api";
import { cn } from "@/lib/utils";

type Props = {
  runId: string;
  item: AiRecruiterRunItem;
  onItemUpdated: (item: AiRecruiterRunItem) => void;
  onError: (message: string) => void;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b pb-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string | null; href?: string | null }) {
  if (!value) {
    return (
      <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">—</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline break-all">
          {value}
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

function PainBar({ label, score, detail }: { label: string; score: number; detail: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{score}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            score >= 70 ? "bg-red-500" : score >= 40 ? "bg-amber-500" : "bg-emerald-500/70",
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function TrendIcon({ trend }: { trend: ProspectDossier["hiring"]["hiringTrend"] }) {
  if (trend === "stijgend") return <TrendingUp className="size-4 text-emerald-600" />;
  if (trend === "dalend") return <TrendingDown className="size-4 text-red-500" />;
  return null;
}

export function ProspectDossierPanel({ runId, item, onItemUpdated, onError }: Props) {
  const [dossier, setDossier] = useState<ProspectDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const loadDossier = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await aiRecruiterFetchJson<{ dossier: ProspectDossier }>(
        "loadDossier",
        `/api/ai-recruiter/runs/${runId}/items/${item.id}/dossier`,
      );
      setDossier(data.dossier);
      setNotes(data.dossier.notes ?? "");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Dossier laden mislukt");
      setDossier(null);
    } finally {
      setLoading(false);
    }
  }, [runId, item.id, onError]);

  useEffect(() => {
    void loadDossier();
  }, [loadDossier]);

  async function saveNotes() {
    if (!dossier?.company.companyId) return;
    setNotesSaving(true);
    try {
      await aiRecruiterFetchJson(
        "saveNotes",
        `/api/ai-recruiter/runs/${runId}/items/${item.id}/notes`,
        { method: "PATCH", body: { notes: notes.trim() || null }, expectedStatuses: [200] },
      );
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Notities opslaan mislukt");
    } finally {
      setNotesSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        Dossier kon niet worden geladen.
      </div>
    );
  }

  const { company, hiring, whyInteresting, painScore, contacts, history, draft, recruitmentIntelligence, recruitmentIntelligenceGeneratedAt, recruitmentIntelligenceIsStale } = dossier;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{dossier.itemStage}</Badge>
          {dossier.totalScore != null ? (
            <Badge variant="secondary">Totaalscore {dossier.totalScore}</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {company.companyId ? (
            <Link
              href={`/companies/${company.companyId}`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Volledig dossier <ExternalLink className="size-3" />
            </Link>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadDossier()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Bedrijfsinformatie */}
      <section className="space-y-4">
        <SectionTitle>Bedrijfsinformatie</SectionTitle>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="size-10 object-contain" />
            ) : (
              <Building2 className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">{company.name}</h2>
            <InfoRow label="Website" value={company.website} href={company.website} />
            <InfoRow label="LinkedIn" value={company.linkedinUrl ? "Bedrijfspagina" : null} href={company.linkedinUrl} />
            <InfoRow label="Locatie" value={company.location} />
            <InfoRow label="Sector" value={company.sector} />
            <InfoRow label="Medewerkers" value={company.employeeLabel} />
            {company.revenueClass ? (
              <InfoRow label="Omzetklasse" value={company.revenueClass} />
            ) : null}
          </div>
        </div>
      </section>

      <Separator />

      {/* Hiring Snapshot */}
      <section className="space-y-4">
        <SectionTitle>Hiring Snapshot</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open vacatures</CardDescription>
              <CardTitle className="text-2xl">{hiring.openVacancies.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Nieuw (30 dagen)</CardDescription>
              <CardTitle className="text-2xl">{hiring.newVacanciesLast30Days}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                Hiring trend <TrendIcon trend={hiring.hiringTrend} />
              </CardDescription>
              <CardTitle className="text-lg capitalize">{hiring.hiringTrend}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{hiring.hiringTrendDetail}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Afdelingen</CardDescription>
              <CardTitle className="text-sm font-normal">
                {hiring.departments.length > 0 ? hiring.departments.join(", ") : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        {hiring.openVacancies.length > 0 ? (
          <ul className="divide-y rounded-lg border text-sm">
            {hiring.openVacancies.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-medium">{v.title}</span>
                <span className="text-xs text-muted-foreground">
                  {[v.location, v.status].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Geen open vacatures in HireFlow.</p>
        )}
      </section>

      <Separator />

      {recruitmentIntelligence ? (
        <>
          <RecruitmentIntelligencePanel
            analysis={recruitmentIntelligence}
            generatedAt={recruitmentIntelligenceGeneratedAt}
            isStale={recruitmentIntelligenceIsStale}
          />
          <Separator />
        </>
      ) : null}

      {/* Waarom interessant */}
      {whyInteresting ? (
        <>
          <section className="space-y-4">
            <SectionTitle>Waarom interessant?</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Sparkles className="size-4 text-emerald-600" />
                    Waarom dit bedrijf interessant is
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{whyInteresting.whyInteresting}</CardContent>
              </Card>
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Waarom recruitment lastig is</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{whyInteresting.whyRecruitmentHard}</CardContent>
              </Card>
              <Card className="border-violet-500/20 bg-violet-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Waarom HireFlow kan helpen</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{whyInteresting.whyHireFlowHelps}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Verwachte kans op opdracht</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums">{whyInteresting.expectedOpportunityPercent}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gebaseerd op leadscore, hiring signalen en opportunity-analyse.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
          <Separator />
        </>
      ) : null}

      {/* Recruitment Pain Score */}
      <section className="space-y-4">
        <SectionTitle>Recruitment Pain Score</SectionTitle>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex size-28 shrink-0 flex-col items-center justify-center rounded-2xl border bg-muted/20">
            <span className="text-3xl font-bold tabular-nums">{painScore.total}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            {painScore.dimensions.map((d) => (
              <PainBar key={d.key} label={d.label} score={d.score} detail={d.detail} />
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* Contacten */}
      <section className="space-y-4">
        <SectionTitle>Contacten</SectionTitle>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen contactpersonen gevonden.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Naam</th>
                  <th className="px-3 py-2 font-medium">Functie</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">LinkedIn</th>
                  <th className="px-3 py-2 font-medium">Vertrouwen</th>
                  <th className="px-3 py-2 font-medium">Bron</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map((c, i) => (
                  <tr key={c.id ?? c.email ?? i} className={cn(c.isSelected && "bg-primary/5")}>
                    <td className="px-3 py-2 font-medium">
                      {c.name}
                      {c.isSelected ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">Geselecteerd</Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.jobTitle ?? "—"}</td>
                    <td className="px-3 py-2">{c.email ?? "—"}</td>
                    <td className="px-3 py-2">
                      {c.linkedinUrl ? (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Profiel
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{c.confidenceLabel}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ProspectContactReview
          runId={runId}
          item={item}
          onUpdated={(updated) => {
            onItemUpdated(updated);
            void loadDossier();
          }}
          onError={onError}
        />
      </section>

      <Separator />

      {/* Historie */}
      <section className="space-y-3">
        <SectionTitle>Historie</SectionTitle>
        <div className="rounded-lg border bg-muted/20 px-4 py-3">
          {history.neverContacted ? (
            <p className="text-sm font-medium">Nog nooit benaderd</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {history.summaryLines.map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  {line}
                </li>
              ))}
              {history.meetingScheduled ? (
                <li className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  Afspraak gepland
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </section>

      <Separator />

      {/* Notities */}
      <section className="space-y-3">
        <SectionTitle>Notities</SectionTitle>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Vrije notities over dit prospect…"
          className="min-h-[100px]"
          disabled={!company.companyId}
        />
        {company.companyId ? (
          <Button type="button" size="sm" variant="outline" disabled={notesSaving} onClick={() => void saveNotes()}>
            {notesSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            Notities opslaan
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Notities zijn beschikbaar zodra het bedrijf is opgeslagen in CRM.</p>
        )}
      </section>

      <Separator />

      <AiEmailWriterPanel
        runId={runId}
        item={item}
        draft={draft.emailWriter}
        draftStatus={draft.status}
        hasAnalysis={recruitmentIntelligence != null}
        onDraftUpdated={(updated: AiEmailWriterDraft) => {
          setDossier((prev) =>
            prev
              ? {
                  ...prev,
                  draft: {
                    ...prev.draft,
                    emailWriter: updated,
                    subject: updated.subject,
                    bodyText: updated.bodyText,
                  },
                }
              : prev,
          );
        }}
        onError={onError}
      />

      {draft.followUpBodyText ? (
        <>
          <Separator />
          <details className="rounded-lg border px-4 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground">Follow-up concept</summary>
            <p className="mt-2 text-xs text-muted-foreground">Onderwerp: {draft.followUpSubject}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{draft.followUpBodyText}</pre>
          </details>
        </>
      ) : null}
    </div>
  );
}
