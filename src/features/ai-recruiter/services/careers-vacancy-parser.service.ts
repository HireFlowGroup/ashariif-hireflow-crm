import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";

const CAREERS_PATH_PATTERN =
  /\/(vacatures?|careers?|jobs?|werken-bij|openings|join-us|work-with-us|vacancy)(\/|$|\?|#)/i;

const CLOSED_VACANCY_PATTERN =
  /\b(gesloten|closed|filled|vervuld|niet meer beschikbaar|no longer available|expired|archief)\b/i;

const LANGUAGE_LABEL_PATTERN =
  /^(english|nederlands|dutch|deutsch|german|français|french|español|spanish)$/i;

const CTA_OR_NAV_PATTERN =
  /^(vacatures?|careers?|jobs?|werken bij|view open roles|bekijk vacature|bekijk onze vacatures|solliciteer|apply now|read more|meer info|lees meer|lees verder|home|contact|sitemap|privacy|cookies|kennismaken\??|find your next job|check our open positions|get on board|join us|open sollicitatie)$/i;

const MARKETING_HEADING_PATTERN =
  /^(vertrouwd door|waarom werken bij|onze beloftes|recente projecten|fun facts|working on it|guided by structure|hey digital native|praten over jouw|smart applications|privacy en cookies|sitemap\.?)$/i;

const JOB_TITLE_PATTERN =
  /\b(manager|developer|engineer|recruiter|consultant|specialist|lead|director|account|success|sales|designer|analyst|advisor|coordinator|intern|vacature|ontwikkelaar|adviseur|medewerker|partner|administratief)\b/i;

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

export function isNonJobCareerLabel(title: string): boolean {
  const normalized = normalizeWhitespace(title);
  if (normalized.length < MIN_TITLE_LENGTH || normalized.length > MAX_TITLE_LENGTH) return true;
  if (CTA_OR_NAV_PATTERN.test(normalized)) return true;
  if (LANGUAGE_LABEL_PATTERN.test(normalized)) return true;
  if (MARKETING_HEADING_PATTERN.test(normalized)) return true;
  if (/^(development|projectmanagement|marketing|sales|support)\(\d+\)$/i.test(normalized)) return true;
  if (/^(werken bij|working at|careers at|vacatures bij|join us at|get on board)\b/i.test(normalized)) return true;
  if (/\bsoftware bedrijf\b/i.test(normalized)) return true;
  if (/\bbedrijf rotterdam\b/i.test(normalized)) return true;
  if (/^(vacatures|careers|jobs)$/i.test(normalized)) return true;
  if (/momenteel geen openstaande vacatures/i.test(normalized)) return true;
  if (/^(waarom|why|how|what|who)\b/i.test(normalized)) return true;
  if (normalized.endsWith("?") && !JOB_TITLE_PATTERN.test(normalized)) return true;
  if (!/[a-zà-ÿ]/i.test(normalized)) return true;
  return false;
}

export function isJobLikeCareerTitle(title: string): boolean {
  if (isNonJobCareerLabel(title)) return false;
  return JOB_TITLE_PATTERN.test(title) || /\b(senior|junior|medior|head of|techlead|tech lead)\b/i.test(title);
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

function vacancyInactiveReason(title: string, surrounding: string): string | null {
  const combined = `${title} ${surrounding}`;
  if (CLOSED_VACANCY_PATTERN.test(combined)) {
    return "Vacature gemarkeerd als gesloten of vervuld";
  }
  return null;
}

function acceptParsedVacancy(title: string, url: string, pageUrl: string): boolean {
  if (!hasConcreteJobUrl(url)) return false;
  if (url.split("#")[0] === pageUrl.split("#")[0]) return false;
  if (!isJobLikeCareerTitle(title)) return false;
  return true;
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
    if (!acceptParsedVacancy(rawText, resolved, pageUrl)) continue;

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
    if (!isJobLikeCareerTitle(title)) continue;

    const snippetStart = Math.max(0, (match.index ?? 0) - 40);
    const snippetEnd = Math.min(html.length, (match.index ?? 0) + match[0].length + 220);
    const surrounding = html.slice(snippetStart, snippetEnd);
    const linkMatch = surrounding.match(/href=["']([^"']+)["']/i);
    const resolved = linkMatch?.[1] ? resolveUrl(pageUrl, linkMatch[1]) : null;
    if (!resolved || !acceptParsedVacancy(title, resolved, pageUrl)) continue;

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
