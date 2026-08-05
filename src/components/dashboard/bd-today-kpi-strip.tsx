"use client";

import {
  Briefcase,
  Building2,
  CalendarCheck,
  Euro,
  Mail,
  MailCheck,
  MessageSquareReply,
  Percent,
  Send,
  Sparkles,
  ThumbsUp,
  UserPlus,
  Users,
} from "lucide-react";

import { KpiCard } from "@/components/dashboard/dashboard-kpi-strip";
import type { BdTodayKpis } from "@/features/dashboard/domain/dashboard.types";

type BdTodayKpiStripProps = {
  today: BdTodayKpis;
};

export function BdTodayKpiStrip({ today }: BdTodayKpiStripProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Vandaag</h2>
        <p className="text-xs text-muted-foreground">Realtime BD-operatie — AI Business Development</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        <KpiCard
          label="Bedrijven gevonden"
          value={today.companiesFound}
          icon={<Building2 className="size-4" />}
          accent="sky"
        />
        <KpiCard
          label="Geanalyseerd"
          value={today.analyzed}
          icon={<Sparkles className="size-4" />}
          accent="violet"
        />
        <KpiCard
          label="Nieuwe contacten"
          value={today.newContacts}
          icon={<UserPlus className="size-4" />}
          accent="amber"
        />
        <KpiCard
          label="Conceptmails"
          value={today.draftEmails}
          icon={<Mail className="size-4" />}
          accent="rose"
        />
        <KpiCard
          label="Verzonden mails"
          value={today.sentEmails}
          icon={<Send className="size-4" />}
          accent="emerald"
        />
        <KpiCard
          label="Open reacties"
          value={today.openReplies}
          icon={<MessageSquareReply className="size-4" />}
          accent="amber"
        />
        <KpiCard
          label="Positieve reacties"
          value={today.positiveReplies}
          icon={<ThumbsUp className="size-4" />}
          accent="emerald"
        />
        <KpiCard
          label="Intakes"
          value={today.intakes}
          icon={<CalendarCheck className="size-4" />}
          accent="violet"
        />
        <KpiCard
          label="Nieuwe vacatures"
          value={today.newVacancies}
          icon={<Briefcase className="size-4" />}
          accent="sky"
        />
        <KpiCard
          label="Kandidaten voorgesteld"
          value={today.candidatesProposed}
          icon={<Users className="size-4" />}
          accent="rose"
        />
        <KpiCard
          label="Plaatsingen"
          value={today.placements}
          icon={<MailCheck className="size-4" />}
          accent="emerald"
        />
        <KpiCard
          label="Conversie"
          value={today.conversionRate}
          icon={<Percent className="size-4" />}
          accent="violet"
          format="percent"
        />
        <KpiCard
          label="Pipeline waarde"
          value={today.pipelineValue}
          icon={<Euro className="size-4" />}
          accent="amber"
          format="currency"
        />
      </div>
    </div>
  );
}
