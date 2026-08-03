import type { HiringSignalProvider } from "@/types/hiring-intelligence";

const PROVIDER_LABELS: Record<HiringSignalProvider, string> = {
  brave_search: "Brave Search",
  google_maps: "Google Maps",
  google_cse: "Google CSE",
  serpapi: "SerpAPI",
  bing_search: "Bing Search",
  firecrawl: "Firecrawl",
  indeed: "Indeed",
  werkenbij: "Werkenbij",
  linkedin: "LinkedIn",
  nationale_vacaturebank: "Nationale Vacaturebank",
  native_crawler: "Native crawler",
  http_fetch: "HTTP fetch",
  playwright: "Playwright",
  manual: "Handmatig",
  legacy: "Legacy",
};

export function formatHiringSignalProvider(provider: string | null | undefined): string {
  if (!provider) return "Onbekend";
  return PROVIDER_LABELS[provider as HiringSignalProvider] ?? provider.replace(/_/g, " ");
}

export function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

export function formatImpact(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(Math.round(value));
}
