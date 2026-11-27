import "server-only";

/** Google/SerpAPI practical query length; discovery variants can exceed this after exclusions. */
export const SERPAPI_DISCOVERY_QUERY_MAX_LEN = 256;

/**
 * Discovery queries are tuned for Tavily/advanced search (inurl:, many -site exclusions).
 * SerpAPI (Google engine) often returns zero organic hits for that syntax.
 */
export function shouldNormalizeSerpDiscoveryQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (/\binurl:/i.test(trimmed)) return true;
  if ((trimmed.match(/-\S+/g)?.length ?? 0) > 4) return true;
  if (trimmed.length > SERPAPI_DISCOVERY_QUERY_MAX_LEN) return true;
  return false;
}

export function prepareSerpApiDiscoveryQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "vacature recruiter Nederland site:vacatures";

  if (!shouldNormalizeSerpDiscoveryQuery(trimmed)) {
    return trimmed.slice(0, SERPAPI_DISCOVERY_QUERY_MAX_LEN);
  }

  const normalized = trimmed
    .replace(/\binurl:\S+/gi, " ")
    .replace(/\bor\b/gi, " ")
    .replace(/"([^"]+)"/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized.split(" ").filter(Boolean);
  const positives: string[] = [];
  const negatives: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("-")) {
      const bare = token.slice(1).replace(/^"|"$/g, "");
      if (bare && negatives.length < 5) negatives.push(`-${bare}`);
    } else {
      positives.push(token);
    }
  }

  let compact = [...positives, ...negatives].join(" ").trim();

  if (!compact) {
    compact = "vacature recruiter Nederland";
  }

  if (compact.length > SERPAPI_DISCOVERY_QUERY_MAX_LEN) {
    compact = compact.slice(0, SERPAPI_DISCOVERY_QUERY_MAX_LEN - 1).trim();
  }

  return compact;
}

/** One-step broadening when the primary (normalized) query returns zero organic results. */
export function buildSerpApiBroadDiscoveryQuery(input: {
  role?: string;
  location?: string;
  sector?: string;
}): string {
  const role = input.role?.trim() || "recruiter";
  const location = input.location?.trim() || "Nederland";
  const sector = input.sector?.trim();
  const parts = ["vacature", role, location];
  if (sector) parts.push(sector);
  parts.push("bedrijf");
  return prepareSerpApiDiscoveryQuery(parts.join(" "));
}