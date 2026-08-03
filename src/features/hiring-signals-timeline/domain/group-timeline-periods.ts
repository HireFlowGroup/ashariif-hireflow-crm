import type {
  HiringSignalTimelineGroup,
  HiringSignalTimelineItem,
} from "@/features/hiring-signals-timeline/domain/timeline.types";

type PeriodDefinition = {
  id: string;
  label: string;
  startMs: number;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = startOfDay(date);
  start.setDate(start.getDate() + diff);
  return start;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildPeriods(now: Date): PeriodDefinition[] {
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const thisWeek = startOfWeek(now);
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const thisMonth = startOfMonth(now);
  const lastMonth = new Date(thisMonth);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  return [
    { id: "today", label: "Vandaag", startMs: today.getTime() },
    { id: "yesterday", label: "Gisteren", startMs: yesterday.getTime() },
    { id: "this-week", label: "Deze week", startMs: thisWeek.getTime() },
    { id: "last-week", label: "Vorige week", startMs: lastWeek.getTime() },
    { id: "this-month", label: "Deze maand", startMs: thisMonth.getTime() },
    { id: "last-month", label: "Vorige maand", startMs: lastMonth.getTime() },
    { id: "older", label: "Ouder", startMs: 0 },
  ];
}

function resolvePeriodId(occurredAt: string, periods: PeriodDefinition[]): string {
  const occurredMs = new Date(occurredAt).getTime();

  for (const period of periods) {
    if (occurredMs >= period.startMs) {
      return period.id;
    }
  }

  return "older";
}

export function groupTimelineItemsByPeriod(
  items: HiringSignalTimelineItem[],
  now = new Date(),
): HiringSignalTimelineGroup[] {
  const periods = buildPeriods(now);
  const buckets = new Map<string, HiringSignalTimelineItem[]>();

  for (const period of periods) {
    buckets.set(period.id, []);
  }

  const sorted = [...items].sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );

  for (const item of sorted) {
    const periodId = resolvePeriodId(item.occurredAt, periods);
    buckets.get(periodId)?.push(item);
  }

  return periods
    .map((period) => ({
      id: period.id,
      label: period.label,
      items: buckets.get(period.id) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}
