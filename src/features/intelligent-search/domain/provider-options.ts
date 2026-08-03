export const INTELLIGENT_SEARCH_PROVIDER_IDS = [
  "signals-brave-web",
  "signals-google-maps",
  "signals-indeed",
  "signals-werkenbij",
  "signals-linkedin",
  "signals-funding-news",
  "signals-firecrawl",
] as const;

export type IntelligentSearchProviderId = (typeof INTELLIGENT_SEARCH_PROVIDER_IDS)[number];

export type IntelligentSearchProviderOption = {
  id: IntelligentSearchProviderId;
  label: string;
  description: string;
};

export const INTELLIGENT_SEARCH_PROVIDER_OPTIONS: IntelligentSearchProviderOption[] = [
  {
    id: "signals-brave-web",
    label: "Web Search",
    description: "Algemene bedrijfs- en vacaturezoekopdrachten",
  },
  {
    id: "signals-google-maps",
    label: "Google Maps",
    description: "Lokale bedrijven op kaart",
  },
  {
    id: "signals-indeed",
    label: "Indeed",
    description: "Vacatures op Indeed.nl",
  },
  {
    id: "signals-werkenbij",
    label: "Werken-bij",
    description: "Careers- en werken-bij pagina's",
  },
  {
    id: "signals-linkedin",
    label: "LinkedIn",
    description: "LinkedIn hiring & recruiter signalen",
  },
  {
    id: "signals-funding-news",
    label: "Funding & Nieuws",
    description: "Groei- en investeringssignalen",
  },
  {
    id: "signals-firecrawl",
    label: "Firecrawl",
    description: "Website-crawl voor ATS & careers",
  },
];

/** Maps free-text provider mentions to canonical ids. */
export const PROVIDER_ALIASES: Record<string, IntelligentSearchProviderId> = {
  brave: "signals-brave-web",
  "brave search": "signals-brave-web",
  web: "signals-brave-web",
  google: "signals-brave-web",
  "google search": "signals-brave-web",
  "google maps": "signals-google-maps",
  maps: "signals-google-maps",
  indeed: "signals-indeed",
  werkenbij: "signals-werkenbij",
  "werken bij": "signals-werkenbij",
  linkedin: "signals-linkedin",
  funding: "signals-funding-news",
  nieuws: "signals-funding-news",
  news: "signals-funding-news",
  firecrawl: "signals-firecrawl",
  crawl: "signals-firecrawl",
};
