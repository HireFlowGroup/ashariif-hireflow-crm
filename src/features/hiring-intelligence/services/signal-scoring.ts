import type { CollectSignalsCriteria, IncomingHiringSignal } from "@/features/hiring-intelligence/domain/signal-types";
import {
  getDefaultImportance,
  type HiringSignalType,
} from "@/features/hiring-intelligence/domain/signal-types";

const RECRUITMENT_KEYWORDS = [
  "recruiter",
  "hr",
  "human resources",
  "talent",
  "vacature",
  "hiring",
  "werken bij",
  "solliciteer",
];

const FUNDING_KEYWORDS = ["funding", "investering", "series a", "series b", "opgehaald", "miljoen"];

const ATS_MARKERS = [
  "greenhouse.io",
  "lever.co",
  "workable.com",
  "recruitee.com",
  "teamtailor",
  "smartrecruiters",
  "ashbyhq",
  "bamboohr",
  "personio",
];

export function scoreImportance(type: HiringSignalType, title: string, description: string): number {
  const base = getDefaultImportance(type);
  const text = `${title} ${description}`.toLowerCase();

  if (RECRUITMENT_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return Math.min(100, base + 8);
  }

  return base;
}

export function scoreAiRelevance(
  signal: Pick<IncomingHiringSignal, "type" | "title" | "description">,
  criteria: CollectSignalsCriteria,
): number {
  let score = 45;
  const text = `${signal.title} ${signal.description}`.toLowerCase();

  if (criteria.sector && text.includes(criteria.sector.toLowerCase())) score += 20;
  if (criteria.city && text.includes(criteria.city.toLowerCase())) score += 10;
  if (criteria.region && text.includes(criteria.region.toLowerCase())) score += 8;
  if (criteria.keywords) {
    for (const word of criteria.keywords.split(/\s+/).filter(Boolean)) {
      if (text.includes(word.toLowerCase())) score += 5;
    }
  }

  if (criteria.vacancyTitles?.length) {
    for (const title of criteria.vacancyTitles) {
      if (text.includes(title.toLowerCase())) score += 12;
    }
  }

  if (criteria.hiringSignalTypes?.length && criteria.hiringSignalTypes.includes(signal.type)) {
    score += 18;
  }

  switch (signal.type) {
    case "vacancy":
    case "indeed_vacancy":
    case "new_hr_manager":
    case "new_recruiter":
    case "ats_detected":
      score += 15;
      break;
    case "careers_page":
    case "linkedin_hiring":
      score += 10;
      break;
    default:
      break;
  }

  return Math.min(100, Math.max(0, score));
}

export function detectSignalTypeFromContent(
  title: string,
  description: string,
  url: string | null,
): HiringSignalType | null {
  const text = `${title} ${description} ${url ?? ""}`.toLowerCase();

  if (url?.includes("indeed.nl")) return "indeed_vacancy";
  if (url?.includes("linkedin.com")) {
    if (text.includes("recruiter") || text.includes("talent acquisition")) return "new_recruiter";
    if (text.includes("hr manager") || text.includes("hr director")) return "new_hr_manager";
    return "linkedin_hiring";
  }
  if (url?.includes("google.com/maps")) return "google_maps_change";
  if (FUNDING_KEYWORDS.some((keyword) => text.includes(keyword))) return "funding";
  if (text.includes("vestiging") || text.includes("new office") || text.includes("locatie")) {
    return "new_location";
  }
  if (text.includes("vacature") || text.includes("vacancy") || text.includes("hiring")) {
    return "vacancy";
  }
  if (text.includes("werken bij") || text.includes("careers") || text.includes("jobs")) {
    return "careers_page";
  }

  return "news";
}

export function detectAtsFromHtml(html: string): boolean {
  const lower = html.toLowerCase();
  return ATS_MARKERS.some((marker) => lower.includes(marker));
}

export function enrichIncomingSignal(
  signal: IncomingHiringSignal,
  criteria: CollectSignalsCriteria,
): IncomingHiringSignal {
  return {
    ...signal,
    importance: scoreImportance(signal.type, signal.title, signal.description),
    aiRelevance: scoreAiRelevance(signal, criteria),
    confidence: Math.min(1, Math.max(0, signal.confidence)),
  };
}
