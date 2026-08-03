import Link from "next/link";
import {
  Activity,
  Briefcase,
  Building2,
  Globe,
  Link2,
  Megaphone,
  Newspaper,
  Radar,
  Server,
  Wrench,
} from "lucide-react";

import { CompanyPriorityPanel } from "@/components/companies/company-priority-panel";
import { CompanyAiAnalysisPanel } from "@/components/companies/detail/company-ai-analysis-panel";
import { CompanyHiringSignalsTimeline } from "@/components/companies/detail/company-hiring-signals-timeline";
import { CompanyOutreachGenerator } from "@/components/companies/detail/company-outreach-generator";
import { CompanyOutreachIntelligencePanel } from "@/components/companies/detail/company-outreach-intelligence";
import { CompanyPageHero } from "@/components/companies/detail/company-page-hero";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyPageData } from "@/features/company-intelligence/domain/company-page.types";
import { cn } from "@/lib/utils";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

const timelineIcons = {
  signal: Radar,
  vacancy: Briefcase,
  outreach: Megaphone,
  task: Wrench,
  company: Building2,
  contact: Activity,
} as const;

export function CompanyIntelligenceSidebar({ data }: { data: CompanyPageData }) {
  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      <CompanyPriorityPanel
        profile={data.priorityProfile}
        compositeScore={data.intelligence.currentScore}
        priority={data.intelligence.currentPriority}
        summary={data.intelligence.scoreReason}
      />
      <CompanyAiAnalysisPanel companyId={data.company.id as string} />
    </div>
  );
}

export function CompanyDigitalPresence({ data }: { data: CompanyPageData }) {
  const { digitalPresence } = data;

  const cards = [
    {
      title: "Website",
      icon: Globe,
      value: digitalPresence.website ?? digitalPresence.domain ?? "Niet gevonden",
      href: digitalPresence.website ?? undefined,
      status: digitalPresence.website ? "Actief" : "Ontbreekt",
    },
    {
      title: "LinkedIn",
      icon: Link2,
      value: digitalPresence.linkedinUrl ? "Bedrijfspagina" : "Niet gekoppeld",
      href: digitalPresence.linkedinUrl ?? undefined,
      status: digitalPresence.linkedinUrl ? "Gekoppeld" : "Ontbreekt",
    },
    {
      title: "ATS",
      icon: Server,
      value: digitalPresence.atsProviders.length
        ? digitalPresence.atsProviders.join(", ")
        : "Niet gedetecteerd",
      status: digitalPresence.atsDetected ? "Gedetecteerd" : "Onbekend",
    },
    {
      title: "Technologie",
      icon: Wrench,
      value: digitalPresence.technologies.length
        ? digitalPresence.technologies.join(", ")
        : "Geen data",
      status: `${digitalPresence.technologies.length} items`,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {card.href ? (
              <a
                href={card.href}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-2 text-sm font-medium text-primary hover:underline"
              >
                {card.value}
              </a>
            ) : (
              <p className="line-clamp-2 text-sm font-medium">{card.value}</p>
            )}
            <Badge variant="outline" className="text-[10px]">
              {card.status}
            </Badge>
            {card.title === "Website" && digitalPresence.careersUrl ? (
              <a
                href={digitalPresence.careersUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-xs text-muted-foreground hover:text-foreground"
              >
                Careers pagina →
              </a>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CompanyHiringTimeline({ data }: { data: CompanyPageData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hiring Timeline</CardTitle>
        <CardDescription>Chronologisch overzicht van signals, vacatures en outreach</CardDescription>
      </CardHeader>
      <CardContent>
        {data.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen hiring activiteit.</p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute bottom-2 left-[15px] top-2 w-px bg-border" />
            {data.timeline.slice(0, 12).map((event) => {
              const Icon = timelineIcons[event.type] ?? Activity;
              const content = (
                <div className="flex gap-4 pb-6 last:pb-0">
                  <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{event.title}</p>
                      {event.meta ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {event.meta}
                        </Badge>
                      ) : null}
                    </div>
                    {event.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">{formatRelative(event.occurredAt)}</p>
                  </div>
                </div>
              );

              return event.href ? (
                <Link key={event.id} href={event.href} className="block transition-opacity hover:opacity-80">
                  {content}
                </Link>
              ) : (
                <div key={event.id}>{content}</div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CompanyVacanciesSection({ data }: { data: CompanyPageData }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Vacatures</CardTitle>
        <CardDescription>{data.vacancies.length} vacature(s) gekoppeld</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.vacancies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen vacatures gevonden.</p>
        ) : (
          data.vacancies.map((vacancy) => (
            <Link
              key={vacancy.id}
              href={`/vacancies/${vacancy.id}`}
              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/40"
            >
              <div>
                <p className="text-sm font-medium">{vacancy.title}</p>
                <p className="text-xs text-muted-foreground">{vacancy.location ?? "—"}</p>
              </div>
              <Badge variant="outline">{vacancy.status}</Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CompanySignalsSection({ data }: { data: CompanyPageData }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Hiring Signals</CardTitle>
        <CardDescription>{data.hiringSignals.length} intelligence signals</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[360px] space-y-2 overflow-auto">
        {data.hiringSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen hiring signals.</p>
        ) : (
          data.hiringSignals.map((signal) => (
            <div key={signal.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {signal.typeLabel}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatRelative(signal.observedAt)}</span>
              </div>
              <p className="mt-1 text-sm font-medium">{signal.title ?? "—"}</p>
              {signal.sourceUrl ? (
                <a
                  href={signal.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-xs text-primary hover:underline"
                >
                  {signal.source ?? "Bron"}
                </a>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CompanyNewsSection({ data }: { data: CompanyPageData }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Newspaper className="size-4 text-muted-foreground" />
          <CardTitle>Nieuws</CardTitle>
        </div>
        <CardDescription>Funding &amp; nieuws signals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.news.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen nieuws signals.</p>
        ) : (
          data.news.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
              ) : null}
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  Lees meer
                </a>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CompanyContactsSection({ data }: { data: CompanyPageData }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Contacten</CardTitle>
        <CardDescription>{data.contacts.length} contactpersoon(en)</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {data.contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen contacten — gebruik contact finder.</p>
        ) : (
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Naam</th>
                <th className="pb-2 font-medium">Functie</th>
                <th className="pb-2 font-medium">E-mail</th>
                <th className="pb-2 font-medium">LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((contact) => (
                <tr key={contact.id} className="border-b last:border-0">
                  <td className="py-2.5 font-medium">
                    {contact.firstName} {contact.lastName}
                  </td>
                  <td className="py-2.5 text-muted-foreground">{contact.jobTitle ?? "—"}</td>
                  <td className="py-2.5">{contact.email ?? "—"}</td>
                  <td className="py-2.5">
                    {contact.linkedinUrl ? (
                      <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Profiel
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function CompanyOutreachSection({ data }: { data: CompanyPageData }) {
  return (
    <div className="space-y-4">
      <CompanyOutreachGenerator companyId={data.company.id} />

      <CompanyOutreachIntelligencePanel
        companyId={data.company.id}
        intelligence={data.outreachIntelligence}
      />

      <Card>
        <CardHeader>
          <CardTitle>Outreach Geschiedenis</CardTitle>
          <CardDescription>
            Status: {data.intelligence.outreachStatus ?? "none"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.outreachHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen outreach — genereer via Outreach Intelligence.</p>
          ) : (
            data.outreachHistory.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{item.status}</Badge>
                  <span className="text-[10px] text-muted-foreground">{formatRelative(item.createdAt)}</span>
                </div>
                {item.messageSubject ? (
                  <p className="mt-2 text-sm font-medium">{item.messageSubject}</p>
                ) : null}
                {item.outreachAngle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{item.outreachAngle}</p>
                ) : null}
                {item.suggestedContactRole ? (
                  <p className="mt-1 text-xs text-muted-foreground">Rol: {item.suggestedContactRole}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CompanyTasksSection({ data }: { data: CompanyPageData }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Open Taken</CardTitle>
        <CardDescription>{data.openTasks.length} openstaande actie(s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.openTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen open taken voor dit bedrijf.</p>
        ) : (
          data.openTasks.map((task) => (
            <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{task.title}</p>
                {task.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <Badge variant="secondary" className="text-[10px]">
                  {task.status}
                </Badge>
                {task.dueAt ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(task.dueAt).toLocaleDateString("nl-NL")}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CompanyActivityFeed({ data }: { data: CompanyPageData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activiteit</CardTitle>
        <CardDescription>Recente wijzigingen en events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {data.activity.map((item) => {
            const row = (
              <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description ? (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatRelative(item.occurredAt)}
                </span>
              </div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href} className="block hover:bg-muted/30">
                {row}
              </Link>
            ) : (
              <div key={item.id}>{row}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanyPageView({ data }: { data: CompanyPageData }) {
  return (
    <div className="space-y-6">
      <CompanyPageHero data={data} />

      <div className="grid gap-6 xl:grid-cols-12">
        <aside className="xl:col-span-4">
          <CompanyIntelligenceSidebar data={data} />
        </aside>

        <div className="space-y-6 xl:col-span-8">
          <CompanyDigitalPresence data={data} />
          <CompanyHiringSignalsTimeline companyId={data.company.id} />

          <div className="grid gap-4 lg:grid-cols-2">
            <CompanyVacanciesSection data={data} />
            <CompanyNewsSection data={data} />
            <CompanyContactsSection data={data} />
            <CompanyOutreachSection data={data} />
            <CompanyTasksSection data={data} />
          </div>

          <CompanyActivityFeed data={data} />
        </div>
      </div>
    </div>
  );
}
