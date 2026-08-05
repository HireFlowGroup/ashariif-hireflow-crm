/** Domains that must never be stored as official company websites. */

export const BLOCKED_OFFICIAL_DOMAINS = [
  "indeed.",
  "linkedin.com",
  "glassdoor.",
  "monster.",
  "nationalevacaturebank.",
  "werkenbij.nl",
  "jobbird.",
  "vacatures.",
  "company.info",
  "telefoonboek",
  "detelefoongids",
  "bedrijvengids",
  "kompass.",
  "yelp.",
  "trustpilot.",
  "crunchbase.com",
  "clutch.co",
  "sortlist.",
  "goodfirms.",
  "google.",
  "bing.com",
  "duckduckgo.",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "wikipedia.org",
  "reddit.com",
  "medium.com",
  "overheid.nl",
  "gemeente",
];

export const VACANCY_BOARD_DOMAINS = [
  "indeed.",
  "linkedin.com/jobs",
  "glassdoor.",
  "monster.",
  "nationalevacaturebank.",
  "werkenbij.nl",
  "jobbird.",
  "vacatures.nl",
  "stepstone.",
  "banenmarkt.",
];

export const DIRECTORY_DOMAINS = [
  "company.info",
  "kompass.",
  "clutch.co",
  "sortlist.",
  "goodfirms.",
  "telefoonboek",
  "detelefoongids",
  "bedrijvengids",
  "yelp.",
  "crunchbase.com/lists",
];

export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isBlockedOfficialDomain(urlOrDomain: string): boolean {
  const lower = urlOrDomain.toLowerCase();
  return BLOCKED_OFFICIAL_DOMAINS.some((blocked) => lower.includes(blocked));
}

export function isVacancyBoardDomain(url: string): boolean {
  const lower = url.toLowerCase();
  return VACANCY_BOARD_DOMAINS.some((host) => lower.includes(host));
}

export function isDirectoryDomain(url: string): boolean {
  const lower = url.toLowerCase();
  return DIRECTORY_DOMAINS.some((host) => lower.includes(host));
}

export function resolveOfficialDomain(url: string): string | null {
  const hostname = extractHostname(url);
  if (!hostname || isBlockedOfficialDomain(hostname)) return null;
  return hostname.replace(/^www\./, "");
}
