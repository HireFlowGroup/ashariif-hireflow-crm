const CAREERS_PATH_PATTERN =
  /\/(vacatures?|careers?|jobs?|werken-bij|openings|join-us|work-with-us|vacancy)(\/|$|\?|#)/i;

const JOB_LINK_PATH_PATTERN =
  /\/(vacatures?|careers?|jobs?|werken-bij|positions?|opening|role|functie)[/\-_a-z0-9]*/i;

const CLOSED_VACANCY_PATTERN =
  /\b(gesloten|closed|filled|vervuld|niet meer beschikbaar|no longer available|expired|archief)\b/i;

const GENERIC_LINK_TEXT_PATTERN =
  /^(vacatures?|careers?|jobs?|werken bij|view open roles|bekijk vacature|solliciteer|apply now|read more|meer info|home|contact)$/i;

const JOB_TITLE_PATTERN =
  /\b(manager|developer|engineer|recruiter|consultant|specialist|lead|director|account|success|sales|designer|analyst|advisor|coordinator|intern|vacature|ontwikkelaar|adviseur)\b/i;

const MIN_TITLE_LENGTH = 4;
const MAX_TITLE_LENGTH = 120;

export type ParsedCareerVacancy = {
  title: string;
  url: string;
  isActive: boolean;
  inactiveReason: string | null;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string): string {
  return normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]+>/g, " ")));
}

function resolveUrl(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sameDomain(url: string, companyDomain: string): boolean {
  const domain = extractDomain(url);
  if (!domain || !companyDomain) return true;
  const normalizedCompany = companyDomain.toLowerCase().replace(/^www\./, "");
  return domain === normalizedCompany || domain.endsWith(`.${normalizedCompany}`);
}

export function discoverCareersPageUrls(html: string, baseUrl: string): string[] {
  const found = new Set<string>();
  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = match[1];
    const text = stripHtml(match[2] ?? "");
    if (!href) continue;

    const resolved = resolveUrl(baseUrl, href);
    if (!resolved) continue;

    if (CAREERS_PATH_PATTERN.test(resolved) || /^(vacatures?|careers?|jobs?|werken bij)$/i.test(text)) {
      found.add(resolved.split("#")[0]!);
    }
  }

  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  for (const suffix of ["/vacatures", "/careers", "/jobs", "/werken-bij", "/nl/careers", "/nl/vacatures"]) {
    found.add(`${base}${suffix}`);
  }

  return [...found];
}

function isPlausibleVacancyTitle(title: string): boolean {
  const normalized = normalizeWhitespace(title);
  if (normalized.length < MIN_TITLE_LENGTH || normalized.length > MAX_TITLE_LENGTH) return false;
  if (GENERIC_LINK_TEXT_PATTERN.test(normalized)) return false;
  if (/^(development|projectmanagement|marketing|sales|support)\(\d+\)$/i.test(normalized)) return false;
  if (/^(werken bij|working at|careers at|vacatures bij|join us at|get on board)\b/i.test(normalized)) return false;
  if (/\bsoftware bedrijf\b/i.test(normalized)) return false;
  if (/\bbedrijf rotterdam\b/i.test(normalized)) return false;
  if (/^(vacatures|careers|jobs)$/i.test(normalized)) return false;
  if (/momenteel geen openstaande vacatures/i.test(normalized)) return false;
  return /[a-zà-ÿ]/i.test(normalized);
}

function vacancyInactiveReason(title: string, surrounding: string): string | null {
  const combined = `${title} ${surrounding}`;
  if (CLOSED_VACANCY_PATTERN.test(combined)) {
    return "Vacature gemarkeerd als gesloten of vervuld";
  }
  return null;
}

export function parseCareersPageVacancies(
  html: string,
  pageUrl: string,
  companyDomain: string,
): ParsedCareerVacancy[] {
  const vacancies: ParsedCareerVacancy[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = match[1];
    const rawText = stripHtml(match[2] ?? "");
    if (!href || !rawText) continue;

    const resolved = resolveUrl(pageUrl, href);
    if (!resolved || !sameDomain(resolved, companyDomain)) continue;
    const hrefLooksLikeJob = JOB_LINK_PATH_PATTERN.test(resolved);
    if (!hrefLooksLikeJob && !JOB_TITLE_PATTERN.test(rawText)) continue;
    if (!isPlausibleVacancyTitle(rawText)) continue;

    const key = `${rawText.toLowerCase()}|${resolved.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const snippetStart = Math.max(0, (match.index ?? 0) - 120);
    const snippetEnd = Math.min(html.length, (match.index ?? 0) + match[0].length + 120);
    const surrounding = stripHtml(html.slice(snippetStart, snippetEnd));
    const inactiveReason = vacancyInactiveReason(rawText, surrounding);

    vacancies.push({
      title: rawText,
      url: resolved.split("#")[0]!,
      isActive: inactiveReason === null,
      inactiveReason,
    });
  }

  const headingPattern = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  for (const match of html.matchAll(headingPattern)) {
    const title = stripHtml(match[1] ?? "");
    if (!isPlausibleVacancyTitle(title)) continue;

    const snippetStart = Math.max(0, (match.index ?? 0) - 40);
    const snippetEnd = Math.min(html.length, (match.index ?? 0) + match[0].length + 220);
    const surrounding = html.slice(snippetStart, snippetEnd);
    const linkMatch = surrounding.match(/href=["']([^"']+)["']/i);
    const resolved = linkMatch?.[1] ? resolveUrl(pageUrl, linkMatch[1]) : pageUrl;
    if (!resolved) continue;
    const hrefLooksLikeJob = JOB_LINK_PATH_PATTERN.test(resolved);
    if (!hrefLooksLikeJob && !JOB_TITLE_PATTERN.test(title)) continue;

    const key = `${title.toLowerCase()}|${resolved.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const inactiveReason = vacancyInactiveReason(title, stripHtml(surrounding));
    vacancies.push({
      title,
      url: resolved.split("#")[0]!,
      isActive: inactiveReason === null,
      inactiveReason,
    });
  }

  return vacancies;
}
