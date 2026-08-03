import type {
  DiscoveryRejectionReason,
  DiscoveryUrlCategory,
  DiscoveryUrlInput,
  HeuristicClassification,
} from "@/features/company-finder/discovery/discovery-quality.types";

const URL_REJECT_SEGMENTS = [
  "/blog",
  "/news",
  "/article",
  "/nieuws",
  "/list",
  "/top",
  "/ranking",
  "/gemeente",
  "/wikipedia",
  "/wiki/",
  "/directory",
  "/overzicht",
  "/lijst",
  "/best-of",
  "/beste-",
  "/guides/",
  "/guide/",
  "/magazine/",
  "/press/",
  "/media/",
  "/tag/",
  "/category/",
  "/topics/",
  "/search?",
];

const TITLE_REJECT_PATTERNS: Array<{ pattern: RegExp; category: DiscoveryUrlCategory; detail: string }> = [
  { pattern: /^top\s+\d+/i, category: "listing", detail: "Top-N lijst" },
  { pattern: /\btop\s+\d+/i, category: "listing", detail: "Top-N ranking in titel" },
  { pattern: /\b(nieuws|news)\b/i, category: "news", detail: "Nieuws in titel" },
  { pattern: /\b(welkom|welcome)\b/i, category: "government", detail: "Welkomstpagina" },
  { pattern: /\bblog\b/i, category: "blog", detail: "Blog in titel" },
  { pattern: /\b(lijst|list|directory|gids|guide)\b/i, category: "directory", detail: "Lijst/directory in titel" },
  { pattern: /\bbeste\s+\d+/i, category: "listing", detail: "Beste-N lijst" },
  { pattern: /^bedrijven\s+/i, category: "directory", detail: "Bedrijven-overzicht" },
  { pattern: /\bbedrijven\s+(in|rotterdam|amsterdam|utrecht|den haag|nederland)\b/i, category: "directory", detail: "Bedrijven-overzicht per regio" },
  { pattern: /^\d+\s+(beste|grootste|top)/i, category: "listing", detail: "Rankinglijst" },
];

const CITY_ONLY_TITLES = new Set(
  [
    "rotterdam",
    "amsterdam",
    "utrecht",
    "den haag",
    "eindhoven",
    "groningen",
    "tilburg",
    "almere",
    "breda",
    "nijmegen",
    "haarlem",
    "arnhem",
    "enschede",
    "nederland",
  ].map((city) => city.toLowerCase()),
);

const BLOCKED_HOSTS = [
  "wikipedia.org",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "linkedin.com/in/",
  "indeed.nl/viewjob",
  "glassdoor.",
  "reddit.com",
  "medium.com",
  "wordpress.com",
  "blogspot.",
  "tumblr.com",
  "pinterest.com",
  "tiktok.com",
  "gemeente",
  "overheid.nl",
  "rijksoverheid.nl",
  "nos.nl",
  "nu.nl",
  "ad.nl",
  "telegraaf.nl",
  "volkskrant.nl",
  "nrc.nl",
  "fd.nl",
  "rtl.nl",
  "tripadvisor.",
  "yelp.",
  "trustpilot.",
  "crunchbase.com/lists",
  "clutch.co",
  "sortlist.",
  "goodfirms.",
];

function normalizeTitle(title: string): string {
  return title
    .replace(/\s*[|\-–—]\s*.+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCategoryFromUrl(url: string): DiscoveryUrlCategory | null {
  const lower = url.toLowerCase();

  if (lower.includes("gemeente") || lower.includes("overheid.nl")) return "government";
  if (URL_REJECT_SEGMENTS.some((segment) => lower.includes(segment))) {
    if (lower.includes("/blog") || lower.includes("blog.")) return "blog";
    if (lower.includes("/news") || lower.includes("/nieuws")) return "news";
    if (lower.includes("/list") || lower.includes("/top") || lower.includes("/ranking")) return "listing";
    return "directory";
  }

  if (lower.includes("indeed.") || lower.includes("glassdoor.") || lower.includes("vacatures.nl")) {
    return "jobboard";
  }

  return null;
}

export function applyDiscoveryHeuristics(input: DiscoveryUrlInput): HeuristicClassification {
  const url = input.url.trim();
  const title = normalizeTitle(input.title);

  if (!url.startsWith("http")) {
    return {
      rejected: true,
      reason: "missing_website",
      category: "unknown",
      detail: "Geen geldige URL",
    };
  }

  const lowerUrl = url.toLowerCase();

  for (const host of BLOCKED_HOSTS) {
    if (lowerUrl.includes(host)) {
      const category: DiscoveryUrlCategory = host.includes("gemeente") || host.includes("overheid")
        ? "government"
        : host.includes("indeed") || host.includes("glassdoor")
          ? "jobboard"
          : host.includes("nos.") || host.includes("nu.nl") || host.includes("telegraaf")
            ? "news"
            : "social";

      return {
        rejected: true,
        reason: "heuristic_blocked_host",
        category,
        detail: `Geblokkeerd domein: ${host}`,
      };
    }
  }

  for (const segment of URL_REJECT_SEGMENTS) {
    if (lowerUrl.includes(segment)) {
      const category = inferCategoryFromUrl(url) ?? "directory";
      return {
        rejected: true,
        reason: "heuristic_url",
        category,
        detail: `URL-segment: ${segment}`,
      };
    }
  }

  for (const rule of TITLE_REJECT_PATTERNS) {
    if (rule.pattern.test(title)) {
      return {
        rejected: true,
        reason: "heuristic_title",
        category: rule.category,
        detail: rule.detail,
      };
    }
  }

  const titleLower = title.toLowerCase();

  if (CITY_ONLY_TITLES.has(titleLower)) {
    return {
      rejected: true,
      reason: "heuristic_title",
      category: "government",
      detail: "Alleen plaatsnaam als titel",
    };
  }

  if (/^welcome to\s+/i.test(title) || /^welkom in\s+/i.test(title) || /^welkom bij\s+/i.test(title)) {
    return {
      rejected: true,
      reason: "heuristic_title",
      category: "government",
      detail: "Welkomstpagina titel",
    };
  }

  if (/^top\s*\d*$/i.test(title) || titleLower === "top 250") {
    return {
      rejected: true,
      reason: "heuristic_title",
      category: "listing",
      detail: "Generieke rankingtitel",
    };
  }

  if (title.length < 2) {
    return {
      rejected: true,
      reason: "heuristic_title",
      category: "unknown",
      detail: "Titel te kort",
    };
  }

  return { rejected: false };
}

/** Heuristic fallback when AI is unavailable. */
export function inferUrlCategoryHeuristic(input: DiscoveryUrlInput): DiscoveryUrlCategory {
  const heuristic = applyDiscoveryHeuristics(input);
  if (heuristic.rejected && heuristic.category) {
    return heuristic.category;
  }

  const urlCategory = inferCategoryFromUrl(input.url);
  if (urlCategory) return urlCategory;

  return "company";
}
