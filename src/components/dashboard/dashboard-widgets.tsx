"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardAreaChart } from "@/components/dashboard/charts/dashboard-charts";
import type {
  DashboardAiRecommendation,
  DashboardRecruiterSignal,
  DashboardSignalItem,
  DashboardSignalTrendPoint,
  DashboardSnapshot,
  DashboardTodaysIntelligence,
  DashboardVacancyItem,
  DashboardWarmLead,
} from "@/features/dashboard/domain/dashboard.types";
import { priorityColorClass } from "@/features/lead-scoring/domain/lead-score.types";
import { SIGNAL_TYPE_LABELS } from "@/features/dashboard/repositories/supabase-dashboard.repository";
import { cn } from "@/lib/utils";
import { DashboardBarChart, DashboardPieChart } from "@/components/dashboard/charts/dashboard-charts";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  return new Date(iso).toLocaleDateString("nl-NL");
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function WarmLeadsWidget({ leads }: { leads: DashboardWarmLead[] }) {
  return (
    <Card className="col-span-full xl:col-span-2">
      <CardHeader>
        <CardTitle>Top 100 Warme Leads</CardTitle>
        <CardDescription>Gesorteerd op leadscore — recruitment intelligence prioriteit</CardDescription>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen gescoorde leads.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Bedrijf</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Intensity</th>
                  <th className="px-3 py-2 font-medium">Signals</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, index) => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={`/companies/${lead.id}`} className="font-medium hover:underline">
                        {lead.name}
                      </Link>
                      {lead.city ? (
                        <p className="text-xs text-muted-foreground">{lead.city}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-semibold">{lead.score ?? "—"}</td>
                    <td className="px-3 py-2">
                      {lead.priority ? (
                        <span className={cn("text-xs font-semibold", priorityColorClass(lead.priority))}>
                          {lead.priority}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{lead.hiringIntensity}</td>
                    <td className="px-3 py-2 tabular-nums">{lead.signalCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HiringSignalsWidget({
  signals,
  trend,
}: {
  signals: DashboardSignalItem[];
  trend: DashboardSignalTrendPoint[];
}) {
  const trendData = trend.map((point) => ({
    label: formatDateLabel(point.date),
    value: point.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nieuwe Hiring Signals</CardTitle>
        <CardDescription>Recente recruitment activiteit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {trendData.length > 0 ? <DashboardAreaChart data={trendData} height={160} /> : null}
        <div className="space-y-2">
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen signals in deze periode.</p>
          ) : (
            signals.slice(0, 8).map((signal) => (
              <div key={signal.id} className="flex items-start justify-between gap-2 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {SIGNAL_TYPE_LABELS[signal.signalType] ?? signal.signalType}
                    </Badge>
                    <span className="truncate text-sm font-medium">{signal.title ?? "—"}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {signal.companyName ?? "Onbekend bedrijf"} · {formatRelative(signal.observedAt)}
                  </p>
                </div>
                {signal.companyId ? (
                  <Link href={`/companies/${signal.companyId}`} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-3.5" />
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VacanciesWidget({ vacancies }: { vacancies: DashboardVacancyItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nieuwe Vacatures</CardTitle>
        <CardDescription>Recent toegevoegde open rollen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {vacancies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen nieuwe vacatures.</p>
        ) : (
          vacancies.slice(0, 8).map((vacancy) => (
            <Link
              key={vacancy.id}
              href={`/vacancies/${vacancy.id}`}
              className="flex items-center justify-between rounded-lg border p-2.5 transition-colors hover:bg-muted/40"
            >
              <div>
                <p className="text-sm font-medium">{vacancy.title}</p>
                <p className="text-xs text-muted-foreground">
                  {vacancy.companyName ?? "—"} · {vacancy.city ?? "—"}
                </p>
              </div>
              <Badge variant="outline">{vacancy.status}</Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function RecruitersWidget({ recruiters }: { recruiters: DashboardRecruiterSignal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nieuwe Recruiters & HR</CardTitle>
        <CardDescription>LinkedIn & hiring team wijzigingen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {recruiters.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen recruiter signals.</p>
        ) : (
          recruiters.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-lg border p-2.5">
              <p className="text-sm font-medium">{item.title ?? "Recruiter signaal"}</p>
              <p className="text-xs text-muted-foreground">
                {item.companyName ?? "—"} · {formatRelative(item.observedAt)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function TodaysIntelligenceWidget({ data }: { data: DashboardTodaysIntelligence }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Intelligence</CardTitle>
        <CardDescription>Daily scan &amp; realtime alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Scan", value: data.scanStatus ?? "—" },
            { label: "Nieuwe signals", value: data.signalsCreated },
            { label: "Bijgewerkt", value: data.signalsUpdated },
            { label: "Bedrijven", value: `${data.companiesProcessed}/${data.companiesTotal}` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-muted/30 p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {data.recentNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen alerts vandaag.</p>
          ) : (
            data.recentNotifications.map((notification) => (
              <Link
                key={notification.id}
                href={`/companies/${notification.companyId}`}
                className="block rounded-lg border p-2.5 hover:bg-muted/40"
              >
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{notification.message}</p>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LeadPriorityWidget({
  distribution,
}: {
  distribution: DashboardSnapshot["priorityDistribution"];
}) {
  const chartData = distribution.map((slice) => ({
    label: slice.label,
    value: slice.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Priority</CardTitle>
        <CardDescription>Verdeling A/B/C/D across portfolio</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen scored leads.</p>
        ) : (
          <DashboardPieChart data={chartData} />
        )}
      </CardContent>
    </Card>
  );
}

export function PipelineHealthWidget({
  pipelineStages,
  outreachDistribution,
}: {
  pipelineStages: DashboardSnapshot["pipelineStages"];
  outreachDistribution: DashboardSnapshot["outreachDistribution"];
}) {
  const pipelineData = pipelineStages.map((stage) => ({
    label: stage.label,
    value: stage.count,
  }));

  const outreachData = outreachDistribution.map((slice) => ({
    label: slice.label,
    value: slice.count,
  }));

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle>Pipeline Health</CardTitle>
        <CardDescription>Candidate pipeline &amp; outreach readiness</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Candidate stages</p>
          {pipelineData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen pipeline entries.</p>
          ) : (
            <DashboardBarChart data={pipelineData} layout="horizontal" height={200} />
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Outreach status</p>
          {outreachData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen outreach data.</p>
          ) : (
            <DashboardBarChart data={outreachData} height={200} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AiRecommendationsWidget({
  recommendations,
}: {
  recommendations: DashboardAiRecommendation[];
}) {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>AI Aanbevelingen</CardTitle>
        <CardDescription>Acties op basis van leadscore, hiring intensity &amp; outreach status</CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen aanbevelingen — voeg bedrijven toe en run intelligence scan.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recommendations.map((item) => (
              <Link
                key={item.id}
                href={`/companies/${item.companyId}`}
                className="group rounded-xl border bg-gradient-to-br from-violet-500/5 to-transparent p-4 transition-colors hover:border-violet-500/30 hover:bg-violet-500/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium group-hover:underline">{item.companyName}</p>
                  {item.priority ? (
                    <Badge variant="secondary">{item.priority}</Badge>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{item.recommendation}</p>
                <p className="mt-3 text-xs font-medium text-violet-600 dark:text-violet-400">{item.action}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function NewCompaniesWidget({ count, leads }: { count: number; leads: DashboardWarmLead[] }) {
  const recent = leads.filter((lead) => lead.lastSignalAt).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nieuwe Bedrijven</CardTitle>
        <CardDescription>{count.toLocaleString("nl-NL")} toegevoegd in periode</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen recente bedrijfsactiviteit.</p>
        ) : (
          recent.map((lead) => (
            <Link
              key={lead.id}
              href={`/companies/${lead.id}`}
              className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/40"
            >
              <span className="text-sm font-medium">{lead.name}</span>
              <Badge variant="outline">{lead.score ?? "—"}</Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
