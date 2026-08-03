import type { ReactNode } from "react";
import type { DashboardKpis } from "@/features/dashboard/domain/dashboard.types";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bell,
  Briefcase,
  Building2,
  Radar,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

type KpiCardProps = {
  label: string;
  value: number;
  icon: ReactNode;
  accent?: "emerald" | "sky" | "amber" | "violet" | "rose";
  suffix?: string;
};

const accentClasses = {
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  sky: "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
  violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
  rose: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400",
};

function KpiCard({ label, value, icon, accent = "sky", suffix }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-80",
          accentClasses[accent],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {value.toLocaleString("nl-NL")}
            {suffix ? <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span> : null}
          </p>
        </div>
        <div className={cn("rounded-lg bg-background/80 p-2 shadow-sm", accentClasses[accent])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

type DashboardKpiStripProps = {
  kpis: DashboardKpis;
};

export function DashboardKpiStrip({ kpis }: DashboardKpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      <KpiCard
        label="Nieuwe Hiring Signals"
        value={kpis.newHiringSignals}
        icon={<Radar className="size-4" />}
        accent="violet"
      />
      <KpiCard
        label="Nieuwe Vacatures"
        value={kpis.newVacancies}
        icon={<Briefcase className="size-4" />}
        accent="sky"
      />
      <KpiCard
        label="Warme Leads"
        value={kpis.warmLeadsCount}
        icon={<Sparkles className="size-4" />}
        accent="emerald"
        suffix="≥70"
      />
      <KpiCard
        label="Nieuwe Bedrijven"
        value={kpis.newCompanies}
        icon={<Building2 className="size-4" />}
        accent="amber"
      />
      <KpiCard
        label="Nieuwe Recruiters"
        value={kpis.newRecruiters}
        icon={<UserPlus className="size-4" />}
        accent="rose"
      />
      <KpiCard
        label="Today's Intelligence"
        value={kpis.todaysIntelligence}
        icon={<Activity className="size-4" />}
        accent="violet"
      />
      <KpiCard
        label="Ongelezen Alerts"
        value={kpis.unreadNotifications}
        icon={<Bell className="size-4" />}
        accent="amber"
      />
      <KpiCard
        label="Top Leads Pool"
        value={kpis.warmLeadsCount}
        icon={<Users className="size-4" />}
        accent="emerald"
      />
    </div>
  );
}
