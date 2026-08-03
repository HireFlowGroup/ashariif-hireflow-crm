const LEGAL_SUFFIXES =
  /\b(b\.?\s?v\.?|n\.?\s?v\.?|holding|groep|group|bv|nv|vof|cv|stichting)\b/gi;

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return `https://${hostname}`;
  } catch {
    return null;
  }
}

export function extractDomain(url: string | null | undefined): string | null {
  const normalized = normalizeWebsite(url);

  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();

  if (!trimmed || !trimmed.includes("@")) {
    return null;
  }

  return trimmed;
}

export function fuzzyNameSimilarity(a: string, b: string): number {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);

  if (!na || !nb) {
    return 0;
  }

  if (na === nb) {
    return 1;
  }

  if (na.includes(nb) || nb.includes(na)) {
    return 0.85;
  }

  const wordsA = new Set(na.split(" ").filter(Boolean));
  const wordsB = new Set(nb.split(" ").filter(Boolean));
  const intersection = [...wordsA].filter((word) => wordsB.has(word));

  if (intersection.length === 0) {
    return 0;
  }

  return intersection.length / Math.max(wordsA.size, wordsB.size);
}

export function employeeRangeToMinMax(range: string | undefined): {
  min: number | null;
  max: number | null;
} {
  switch (range) {
    case "1-10":
      return { min: 1, max: 10 };
    case "11-50":
      return { min: 11, max: 50 };
    case "51-200":
      return { min: 51, max: 200 };
    case "201-1000":
      return { min: 201, max: 1000 };
    case "1000+":
      return { min: 1000, max: null };
    default:
      return { min: null, max: null };
  }
}

export function createCandidateKey(candidate: {
  domain?: string | null;
  website?: string | null;
  normalizedName: string;
  city?: string | null;
  externalId?: string;
}): string {
  const domain = candidate.domain ?? extractDomain(candidate.website);

  if (domain) {
    return `domain::${domain}`;
  }

  if (candidate.externalId) {
    return `ext::${candidate.externalId}`;
  }

  const city = candidate.city?.trim().toLowerCase() ?? "";
  return `name::${candidate.normalizedName}::${city}`;
}
