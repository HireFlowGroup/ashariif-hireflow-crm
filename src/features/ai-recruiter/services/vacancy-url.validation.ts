const CAREERS_LISTING_PATH =
  /^\/(vacatures?|careers?|jobs?|werken-bij|openings?|join-us|work-with-us|vacancy)\/?$/i;

const LISTING_SEGMENT = new Set([
  "vacatures",
  "vacature",
  "careers",
  "career",
  "jobs",
  "job",
  "werken-bij",
  "openings",
  "opening",
  "join-us",
  "work-with-us",
  "vacancy",
  "positions",
  "position",
]);

function normalizePathname(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.pathname.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

function isHomepageOnlyPath(path: string): boolean {
  return path === "" || path === "/";
}

/** Listing pages (/vacatures, /careers, …) are not concrete job URLs. */
export function isCareersListingPath(path: string): boolean {
  return CAREERS_LISTING_PATH.test(path);
}

/** True when URL points to a specific job detail page, not a listing or homepage. */
export function hasConcreteJobUrl(jobUrl: string): boolean {
  if (!jobUrl.trim()) return false;

  const path = normalizePathname(jobUrl);
  if (!path || isHomepageOnlyPath(path)) return false;
  if (isCareersListingPath(path)) return false;

  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return false;

  const lastSegment = segments[segments.length - 1]?.toLowerCase() ?? "";
  if (LISTING_SEGMENT.has(lastSegment)) return false;
  if (lastSegment.length < 3) return false;

  return true;
}
