import { hasAnySearchProvider } from "@/features/lead-intelligence/providers/manager/provider-config";
import { createSearchSignalProvider } from "@/features/hiring-intelligence/providers/shared/search-signal.mapper";
import type { HiringSignalProvider } from "@/features/hiring-intelligence/providers/types";

function buildSearchSignalProviders(): HiringSignalProvider[] {
  const searchEnabled = hasAnySearchProvider("search-signal.providers");
  const skipReason = searchEnabled ? undefined : "Geen zoekprovider geconfigureerd";

  return [
    createSearchSignalProvider({
      id: "signals-brave-web",
      displayName: "Brave Search",
      order: 1,
      provider: "brave_search",
      source: "Brave Search",
      querySuffix: "bedrijf vacature Nederland",
      defaultType: "vacancy",
      enabled: searchEnabled,
      skipReason,
    }),
    createSearchSignalProvider({
      id: "signals-google-maps",
      displayName: "Google Maps",
      order: 2,
      provider: "google_maps",
      source: "Google Maps",
      querySuffix: "site:google.com/maps bedrijf",
      defaultType: "google_maps_change",
      enabled: searchEnabled,
      skipReason,
      mapType: () => "google_maps_change",
    }),
    createSearchSignalProvider({
      id: "signals-indeed",
      displayName: "Indeed",
      order: 3,
      provider: "indeed",
      source: "Indeed",
      querySuffix: "site:indeed.nl vacature",
      defaultType: "indeed_vacancy",
      enabled: searchEnabled,
      skipReason,
      mapType: () => "indeed_vacancy",
    }),
    createSearchSignalProvider({
      id: "signals-werkenbij",
      displayName: "Werken-bij",
      order: 4,
      provider: "werkenbij",
      source: "Werken-bij",
      querySuffix: '"werken bij" OR werkenbij vacatures',
      defaultType: "careers_page",
      enabled: searchEnabled,
      skipReason,
      mapType: () => "careers_page",
    }),
    createSearchSignalProvider({
      id: "signals-linkedin",
      displayName: "LinkedIn",
      order: 5,
      provider: "linkedin",
      source: "LinkedIn",
      querySuffix: "site:linkedin.com/company OR site:linkedin.com/jobs hiring",
      defaultType: "linkedin_hiring",
      enabled: searchEnabled,
      skipReason,
      mapType: (result) => {
        const text = `${result.title} ${result.description}`.toLowerCase();
        if (text.includes("recruiter") || text.includes("talent acquisition")) return "new_recruiter";
        if (text.includes("hr manager") || text.includes("hr director")) return "new_hr_manager";
        return "linkedin_hiring";
      },
    }),
    createSearchSignalProvider({
      id: "signals-funding-news",
      displayName: "Funding & Nieuws",
      order: 6,
      provider: "brave_search",
      source: "Brave Search",
      querySuffix: "funding OR investering OR nieuws vacatures",
      defaultType: "news",
      enabled: searchEnabled,
      skipReason,
    }),
  ];
}

export function getSearchSignalProviders(): HiringSignalProvider[] {
  return buildSearchSignalProviders();
}
