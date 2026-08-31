import type {
  DiscoveryRejectionReason,
  DiscoveryUrlCategory,
  DiscoveryUrlInput,
  HeuristicClassification,
} from "@/features/company-finder/discovery/discovery-quality.types";
import { categoryToRejectionReason } from "@/features/company-finder/discovery/discovery-quality.types";

/**
 * High-confidence host / path patterns that may block a URL.
 * Heuristics MUST NOT reject outside these categories.
 */
type HighConfidenceBlock = {
  match: RegExp;
  category: DiscoveryUrlCategory;
  reason: DiscoveryRejectionReason;
  detail: string;
};

const HIGH_CONFIDENCE_BLOCKS: HighConfidenceBlock[] = [
  {
    match: /wikipedia\.org|\.wikipedia\.|\/wiki\//i,
    category: "directory",
    reason: "wikipedia",
    detail: "Wikipedia",
  },
  {
    match: /gemeente|overheid\.nl|rijksoverheid\.nl/i,
    category: "government",
    reason: "government",
    detail: "Gemeente/overheid",
  },
  {
    match: /(?:^|[/.])blog(?:[/.]|$)|\/blog\/|blogspot\.|medium\.com/i,
    category: "blog",
    reason: "blog",
    detail: "Blog",
  },
  {
    match: /\/nieuws\/|\/news\/|(?:^|[/.])nieuws(?:[/.]|$)|nos\.nl|nu\.nl|telegraaf\.nl|volkskrant\.nl|nrc\.nl|ad\.nl|fd\.nl/i,
    category: "news",
    reason: "news",
    detail: "Nieuws",
  },
  {
    match: /vacaturebank|indeed\.|glassdoor\.|nationalevacaturebank|werk\.nl\/vacatures|linkedin\.com\/jobs/i,
    category: "jobboard",
    reason: "jobboard",
    detail: "Vacaturebank",
  },
  {
    match: /\/directory\/|bedrijvengids|yellowpages|goudengids|company\.directory|crunchbase\.com\/lists|clutch\.co|sortlist\.|goodfirms\./i,
    category: "directory",
    reason: "directory",
    detail: "Directory",
  },
  {
    match: /\/forum\/|forum\.|reddit\.com|discourse\.|community\.forum/i,
    category: "forum",
    reason: "forum",
    detail: "Forum",
  },
  {
    match: /\/article\/.*top|\/top-\d+|\/top\/\d+|\/best-of\/|\/beste-\d+/i,
    category: "listing",
    reason: "directory",
    detail: "Ranking/listicle URL",
  },
];

const TITLE_HIGH_CONFIDENCE: Array<{
  pattern: RegExp;
  category: DiscoveryUrlCategory;
  reason: DiscoveryRejectionReason;
  detail: string;
}> = [
  {
    pattern: /\b(bedrijvengids|company directory|yellow pages)\b/i,
    category: "directory",
    reason: "directory",
    detail: "Directory in titel",
  },
  {
    pattern: /^top\s+\d+/i,
    category: "listing",
    reason: "directory",
    detail: "Top-N lijst in titel",
  },
  {
    pattern: /\btop\s+\d+\s+bedrijven\b/i,
    category: "listing",
    reason: "directory",
    detail: "Top-N bedrijvenlijst",
  },
  {
    pattern: /\bvacaturebank\b/i,
    category: "jobboard",
    reason: "jobboard",
    detail: "Vacaturebank in titel",
  },
  {
    pattern: /\b(wikipedia)\b/i,
    category: "directory",
    reason: "wikipedia",
    detail: "Wikipedia in titel",
  },
];

function normalizeTitle(title: string): string {
  return title
    .replace(/\s*[|\-–—]\s*.+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristics may only block when wikipedia / gemeente / blog / nieuws /
 * vacaturebank / directory / forum are detected with high confidence.
 */
export function applyDiscoveryHeuristics(input: DiscoveryUrlInput): HeuristicClassification {
  const url = input.url.trim();
  const title = normalizeTitle(input.title);

  if (!url.startsWith("http")) {
    return {
      rejected: true,
      reason: "missing_website",
      category: "unknown",
      detail: "Geen geldige URL",
      highConfidence: true,
    };
  }

  const haystack = `${url} ${title}`.toLowerCase();

  for (const block of HIGH_CONFIDENCE_BLOCKS) {
    if (block.match.test(haystack)) {
      return {
        rejected: true,
        reason: block.reason,
        category: block.category,
        detail: `Hoge zekerheid: ${block.detail}`,
        highConfidence: true,
      };
    }
  }

  for (const rule of TITLE_HIGH_CONFIDENCE) {
    if (rule.pattern.test(title)) {
      return {
        rejected: true,
        reason: rule.reason,
        category: rule.category,
        detail: `Hoge zekerheid: ${rule.detail}`,
        highConfidence: true,
      };
    }
  }

  if (title.length < 1) {
    return { rejected: false, highConfidence: false };
  }

  return { rejected: false, highConfidence: false };
}

/** Soft category hint when AI is unavailable — never used alone to hard-reject outside blocklist. */
export function inferUrlCategoryHeuristic(input: DiscoveryUrlInput): DiscoveryUrlCategory {
  const heuristic = applyDiscoveryHeuristics(input);
  if (heuristic.rejected && heuristic.category) {
    return heuristic.category;
  }

  const lower = input.url.toLowerCase();
  if (lower.includes("linkedin.com") || lower.includes("facebook.com")) return "social";
  return "company";
}

export function rejectionReasonFromHeuristic(
  heuristic: HeuristicClassification,
): DiscoveryRejectionReason {
  if (heuristic.reason) return heuristic.reason;
  if (heuristic.category) return categoryToRejectionReason(heuristic.category);
  return "low_confidence";
}
