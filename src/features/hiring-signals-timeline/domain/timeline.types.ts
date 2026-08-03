import type { HiringSignalType } from "@/features/hiring-intelligence/domain/signal-types";

export const TIMELINE_FILTER_IDS = [
  "all",
  "vacancies",
  "news",
  "website",
  "recruitment",
  "growth",
  "linkedin",
] as const;

export type TimelineFilterId = (typeof TIMELINE_FILTER_IDS)[number];

export const TIMELINE_FILTERS: Record<
  TimelineFilterId,
  { label: string; types: HiringSignalType[] | null }
> = {
  all: { label: "Alles", types: null },
  vacancies: {
    label: "Vacatures",
    types: ["vacancy", "indeed_vacancy", "careers_page"],
  },
  news: { label: "Nieuws", types: ["news", "funding"] },
  website: { label: "Website", types: ["website_change", "ats_detected"] },
  recruitment: {
    label: "Recruitment",
    types: ["new_recruiter", "new_hr_manager", "linkedin_hiring"],
  },
  growth: {
    label: "Groei",
    types: ["new_location", "funding", "google_maps_change"],
  },
  linkedin: { label: "LinkedIn", types: ["linkedin_hiring", "new_recruiter"] },
};

export type HiringSignalTimelineItemKind = "signal" | "score_change";

export type HiringSignalTimelineItem = {
  id: string;
  kind: HiringSignalTimelineItemKind;
  title: string;
  description: string | null;
  occurredAt: string;
  source: string | null;
  sourceUrl: string | null;
  confidence: number | null;
  aiImpact: number;
  recruitmentImpact: number;
  signalType?: HiringSignalType;
  typeLabel?: string;
  provider?: string | null;
  scoreDelta?: number;
};

export type HiringSignalTimelineGroup = {
  id: string;
  label: string;
  items: HiringSignalTimelineItem[];
};

export type HiringSignalsTimelineResponse = {
  filter: TimelineFilterId;
  groups: HiringSignalTimelineGroup[];
  totalCount: number;
  generatedAt: string;
  watermark: string;
};

export function parseTimelineFilter(value: string | null | undefined): TimelineFilterId {
  if (value && TIMELINE_FILTER_IDS.includes(value as TimelineFilterId)) {
    return value as TimelineFilterId;
  }

  return "all";
}
