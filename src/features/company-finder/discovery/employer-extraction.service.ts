/** Extract employer name from vacancy titles, snippets and URLs. */

const VACANCY_TITLE_PREFIXES = [
  /^customer success manager\b/i,
  /^account\s?manager\b/i,
  /^recruiter\b/i,
  /^senior\s+/i,
  /^junior\s+/i,
  /^medior\s+/i,
];

const EMPLOYER_FROM_TITLE_PATTERNS = [
  /\bat\s+([A-Z][A-Za-z0-9&.\- ]{2,60})\b/,
  /\|\s*([A-Z][A-Za-z0-9&.\- ]{2,60})\s*$/,
  /^([A-Z][A-Za-z0-9&.\- ]{2,60})\s*[-–—|]\s*/,
  /^([A-Z][A-Za-z0-9&.\- ]{2,60})\s+(zoekt|hiring|vacature)/i,
];

const EMPLOYER_FROM_SNIPPET_PATTERNS = [
  /\b(?:werkgever|employer|company|bedrijf|organisatie):\s*([A-Z][A-Za-z0-9&.\- ]{2,60})/i,
  /\b(?:bij|at|for)\s+([A-Z][A-Za-z0-9&.\- ]{2,60})\b/,
  /\b([A-Z][A-Za-z0-9&.\- ]{2,60})\s+(?:zoekt|is hiring|sucht|recruiteert)\b/,
  /\bhiringOrganization["\s:]+\{[^}]*"name"\s*:\s*"([^"]+)"/i,
];

const GENERIC_TITLE_REJECT = [
  /\b(specialists?|companies|bedrijven|agencies)\s+(in|voor)\b/i,
  /\bvacatures?\s+in\b/i,
  /\btop\s+\d+\b/i,
  /\bbeste\s+\d+\b/i,
  /\bsoftware\s+vacatures\b/i,
  /\brecruitment\s+specialists?\b/i,
  /\bin\s+(netherlands|nederland|rotterdam|den haag)\s*$/i,
];

function cleanEmployerName(name: string): string | null {
  const cleaned = name
    .replace(/\s*[|\-–—]\s*.+$/, "")
    .replace(/\s+(vacature|job|hiring|careers|vacatures).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 2 || cleaned.length > 80) return null;
  if (GENERIC_TITLE_REJECT.some((p) => p.test(cleaned))) return null;
  if (VACANCY_TITLE_PREFIXES.some((p) => p.test(cleaned))) return null;
  return cleaned;
}

export function isLikelyVacancyTitle(title: string): boolean {
  const trimmed = title.trim();
  if (VACANCY_TITLE_PREFIXES.some((p) => p.test(trimmed))) return true;
  if (/\bin\s+(netherlands|nederland|rotterdam|den haag|amsterdam)\b/i.test(trimmed)) return true;
  if (/\bvacature\b/i.test(trimmed)) return true;
  if (/\b(job|hiring|gezocht)\b/i.test(trimmed)) return true;
  return false;
}

export function extractEmployerFromVacancy(input: {
  title: string;
  url?: string;
  description?: string | null;
}): { employerName: string | null; vacancyTitle: string | null; confidence: number; reason: string } {
  const title = input.title.trim();
  const snippet = input.description ?? "";

  if (GENERIC_TITLE_REJECT.some((p) => p.test(title))) {
    return {
      employerName: null,
      vacancyTitle: isLikelyVacancyTitle(title) ? title : null,
      confidence: 0.9,
      reason: "Generieke titel — geen betrouwbare werkgever",
    };
  }

  for (const pattern of EMPLOYER_FROM_TITLE_PATTERNS) {
    const match = title.match(pattern);
    if (match?.[1]) {
      const employer = cleanEmployerName(match[1]);
      if (employer) {
        return {
          employerName: employer,
          vacancyTitle: isLikelyVacancyTitle(title) ? title : null,
          confidence: 0.85,
          reason: "Werkgever uit vacaturetitel",
        };
      }
    }
  }

  for (const pattern of EMPLOYER_FROM_SNIPPET_PATTERNS) {
    const match = snippet.match(pattern);
    if (match?.[1]) {
      const employer = cleanEmployerName(match[1]);
      if (employer) {
        return {
          employerName: employer,
          vacancyTitle: isLikelyVacancyTitle(title) ? title : null,
          confidence: 0.78,
          reason: "Werkgever uit snippet/structured data",
        };
      }
    }
  }

  if (isLikelyVacancyTitle(title)) {
    return {
      employerName: null,
      vacancyTitle: title,
      confidence: 0.7,
      reason: "Vacaturetitel zonder betrouwbare werkgever",
    };
  }

  return {
    employerName: null,
    vacancyTitle: null,
    confidence: 0.3,
    reason: "Geen werkgever gevonden",
  };
}
