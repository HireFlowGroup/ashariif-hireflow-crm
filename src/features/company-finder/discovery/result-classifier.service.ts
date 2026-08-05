import type { ProspectResultType } from "@/features/ai-recruiter/domain/concept-eligibility.types";

export type ClassifiedSearchResult = {
  resultType: ProspectResultType;
  classificationReason: string;
  classificationConfidence: number;
  employerName: string | null;
  vacancyTitle: string | null;
  shouldSaveAsCompany: boolean;
};

const VACANCY_TITLE_PATTERNS = [
  /^customer success manager\b/i,
  /^account\s?manager\b/i,
  /^recruiter\b/i,
  /\bin\s+(netherlands|nederland|rotterdam|den haag|amsterdam)\b/i,
  /\bvacature\b/i,
  /\bjob\b/i,
  /\bhiring\b/i,
];

const DIRECTORY_PATTERNS = [
  /\btop\s+\d+/i,
  /\bbeste\s+\d+/i,
  /\bbedrijven\s+(in|rotterdam|amsterdam|den haag|nederland)\b/i,
  /\bdirectory\b/i,
  /\boverzicht\b/i,
  /\branking\b/i,
  /\blist\b/i,
  /\bgids\b/i,
  /\bagency\b/i,
  /\brecruitment agency\b/i,
];

const VACANCY_BOARD_HOSTS = [
  "indeed.",
  "linkedin.com/jobs",
  "glassdoor.",
  "monster.",
  "nationalevacaturebank.",
  "werkenbij.nl",
  "jobbird.",
  "vacatures.",
];

const ARTICLE_PATTERNS = [/\bblog\b/i, /\bnews\b/i, /\bnieuws\b/i, /\barticle\b/i];

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function looksLikeVacancyTitle(title: string): boolean {
  return VACANCY_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()));
}

function looksLikeDirectory(title: string, url: string): boolean {
  const lower = title.toLowerCase();
  if (DIRECTORY_PATTERNS.some((pattern) => pattern.test(title))) return true;
  if (/\/(directory|list|top|beste|overzicht|ranking)\b/i.test(url)) return true;
  if (/\bsoftware vacatures\b/i.test(lower)) return true;
  return false;
}

function isVacancyBoardHost(url: string): boolean {
  const domain = extractDomain(url);
  return VACANCY_BOARD_HOSTS.some((host) => domain.includes(host) || url.includes(host));
}

function isCareersPage(url: string, title: string): boolean {
  return (
    /\/(careers|vacatures|jobs|werken-bij|werkenbij)\b/i.test(url)
    || /\b(werken bij|careers|vacatures)\b/i.test(title)
  );
}

export function classifySearchResult(input: {
  title: string;
  url: string;
  description?: string | null;
}): ClassifiedSearchResult {
  const title = input.title.trim();
  const url = input.url.trim();
  const description = input.description ?? "";

  if (!title || !url) {
    return {
      resultType: "unknown",
      classificationReason: "Lege titel of URL",
      classificationConfidence: 0.9,
      employerName: null,
      vacancyTitle: null,
      shouldSaveAsCompany: false,
    };
  }

  if (looksLikeDirectory(title, url)) {
    return {
      resultType: "directory",
      classificationReason: "Titel/URL wijst op directory of rankinglijst",
      classificationConfidence: 0.92,
      employerName: null,
      vacancyTitle: null,
      shouldSaveAsCompany: false,
    };
  }

  if (ARTICLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return {
      resultType: "article",
      classificationReason: "Nieuws- of blogartikel",
      classificationConfidence: 0.88,
      employerName: null,
      vacancyTitle: null,
      shouldSaveAsCompany: false,
    };
  }

  if (isVacancyBoardHost(url) && !isCareersPage(url, title)) {
    const vacancyTitle = looksLikeVacancyTitle(title) ? title : null;
    return {
      resultType: vacancyTitle ? "vacancy" : "vacancy_board",
      classificationReason: vacancyTitle
        ? "Vacature op jobboard — werkgever moet worden afgeleid"
        : "Vacatureplatform-overzicht — geen direct bedrijf",
      classificationConfidence: 0.85,
      employerName: null,
      vacancyTitle,
      shouldSaveAsCompany: false,
    };
  }

  if (looksLikeVacancyTitle(title)) {
    return {
      resultType: "vacancy",
      classificationReason: "Titel is een vacature, geen bedrijfsnaam",
      classificationConfidence: 0.9,
      employerName: null,
      vacancyTitle: title,
      shouldSaveAsCompany: false,
    };
  }

  if (isCareersPage(url, title)) {
    return {
      resultType: "company_careers_page",
      classificationReason: "Werken-bij/careers pagina van werkgever",
      classificationConfidence: 0.82,
      employerName: title.replace(/\s*(careers|vacatures|werken bij).*$/i, "").trim() || null,
      vacancyTitle: null,
      shouldSaveAsCompany: true,
    };
  }

  if (/\/search[/?]/i.test(url)) {
    return {
      resultType: "search_result_page",
      classificationReason: "Zoekresultatenpagina",
      classificationConfidence: 0.9,
      employerName: null,
      vacancyTitle: null,
      shouldSaveAsCompany: false,
    };
  }

  return {
    resultType: "company",
    classificationReason: "Bedrijfswebsite of bedrijfsprofiel",
    classificationConfidence: 0.7,
    employerName: title,
    vacancyTitle: null,
    shouldSaveAsCompany: true,
  };
}
