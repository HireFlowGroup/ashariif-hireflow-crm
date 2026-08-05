import type { DiscoveryResultType } from "@/features/company-finder/discovery/discovery-result.types";
import {
  isBlockedOfficialDomain,
  isDirectoryDomain,
  isVacancyBoardDomain,
  resolveOfficialDomain,
} from "@/features/company-finder/discovery/discovery-domain-blocklist";
import { detectRecruitmentCompetitor } from "@/features/company-finder/discovery/competitor-detection.service";
import {
  extractEmployerFromVacancy,
  isLikelyVacancyTitle,
} from "@/features/company-finder/discovery/employer-extraction.service";
import type { ProspectResultType } from "@/features/ai-recruiter/domain/concept-eligibility.types";

export type ClassifiedDiscoveryResult = {
  resultType: DiscoveryResultType;
  legacyResultType: ProspectResultType;
  classificationReason: string;
  classificationConfidence: number;
  employerName: string | null;
  vacancyTitle: string | null;
  officialDomain: string | null;
  domainConfidence: number | null;
  domainSource: string | null;
  excludedCompetitor: boolean;
  shouldSaveAsCompany: boolean;
  shouldResolveEmployer: boolean;
};

const LIST_ARTICLE_PATTERNS = [
  /^top\s+\d+/i,
  /\btop\s+\d+/i,
  /\bbeste\s+\d+/i,
  /^\d+\s+(beste|grootste|top)/i,
  /\bcompanies\s+in\b/i,
  /\bbedrijven\s+(in|rotterdam|amsterdam|den haag|nederland)\b/i,
  /\boverzicht\b/i,
  /\branking\b/i,
  /\blargest\s+companies\b/i,
];

const DIRECTORY_TITLE_PATTERNS = [
  /\bdirectory\b/i,
  /\bgids\b/i,
  /\boverzicht\b/i,
  /\bbedrijven\s+(in|rotterdam|amsterdam|den haag|nederland)\b/i,
  /\bsoftware\s+vacatures\b/i,
  /\blist\b/i,
  /\bfind\s+a\s+company\b/i,
];

const NEWS_PATTERNS = [/\bblog\b/i, /\bnews\b/i, /\bnieuws\b/i, /\barticle\b/i, /\bpress\b/i];

const SEARCH_PAGE_PATTERNS = [/\/search[/?]/i, /[?&]q=/i, /\/zoeken/i];

function isCareersPage(url: string, title: string): boolean {
  return (
    /\/(careers|vacatures|jobs|werken-bij|werkenbij|open-positions|vacatures-overzicht)\b/i.test(url)
    || /\b(werken bij|careers|vacatures|openstaande functies)\b/i.test(title)
  );
}

function cleanCompanyNameFromTitle(title: string): string {
  return title
    .replace(/\s*[|\-–—]\s*.+$/, "")
    .replace(/\s+(careers|vacatures|werken bij|home|homepage).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyDiscoveryResult(input: {
  title: string;
  url: string;
  description?: string | null;
  excludeRecruitmentAgencies?: boolean;
}): ClassifiedDiscoveryResult {
  const title = input.title.trim();
  const url = input.url.trim();
  const description = input.description ?? "";

  const base = {
    employerName: null as string | null,
    vacancyTitle: null as string | null,
    officialDomain: null as string | null,
    domainConfidence: null as number | null,
    domainSource: null as string | null,
    excludedCompetitor: false,
    shouldSaveAsCompany: false,
    shouldResolveEmployer: false,
  };

  if (!title || !url) {
    return {
      ...base,
      resultType: "unknown",
      legacyResultType: "unknown",
      classificationReason: "Lege titel of URL",
      classificationConfidence: 0.95,
    };
  }

  const competitor = detectRecruitmentCompetitor({
    title,
    url,
    description,
    excludeRecruitmentAgencies: input.excludeRecruitmentAgencies ?? true,
  });

  if (competitor.isCompetitor) {
    return {
      ...base,
      resultType: "recruitment_agency",
      legacyResultType: "directory",
      classificationReason: competitor.reason,
      classificationConfidence: competitor.confidence,
      excludedCompetitor: true,
    };
  }

  if (LIST_ARTICLE_PATTERNS.some((p) => p.test(title))) {
    return {
      ...base,
      resultType: "list_article",
      legacyResultType: "directory",
      classificationReason: "Lijst- of rankingartikel — geen individueel bedrijf",
      classificationConfidence: 0.93,
    };
  }

  if (
    DIRECTORY_TITLE_PATTERNS.some((p) => p.test(title))
    || isDirectoryDomain(url)
    || /\/(directory|list|top|beste|overzicht|ranking|lijst)\b/i.test(url)
  ) {
    return {
      ...base,
      resultType: "business_directory",
      legacyResultType: "directory",
      classificationReason: "Directory of bedrijvenoverzicht",
      classificationConfidence: 0.91,
    };
  }

  if (NEWS_PATTERNS.some((p) => p.test(title))) {
    return {
      ...base,
      resultType: "news_article",
      legacyResultType: "article",
      classificationReason: "Nieuws- of blogartikel",
      classificationConfidence: 0.88,
    };
  }

  if (SEARCH_PAGE_PATTERNS.some((p) => p.test(url))) {
    return {
      ...base,
      resultType: "search_result_page",
      legacyResultType: "search_result_page",
      classificationReason: "Zoekresultatenpagina",
      classificationConfidence: 0.9,
    };
  }

  if (isVacancyBoardDomain(url) && !isCareersPage(url, title)) {
    const extracted = extractEmployerFromVacancy({ title, url, description });
    return {
      ...base,
      resultType: extracted.employerName ? "individual_vacancy" : "vacancy_board",
      legacyResultType: extracted.employerName ? "vacancy" : "vacancy_board",
      classificationReason: extracted.employerName
        ? extracted.reason
        : "Vacatureplatform — werkgever onbekend",
      classificationConfidence: extracted.confidence,
      employerName: extracted.employerName,
      vacancyTitle: extracted.vacancyTitle ?? (isLikelyVacancyTitle(title) ? title : null),
      shouldResolveEmployer: !extracted.employerName,
    };
  }

  if (isLikelyVacancyTitle(title)) {
    const extracted = extractEmployerFromVacancy({ title, url, description });
    if (extracted.employerName) {
      const domain = resolveOfficialDomain(url);
      return {
        ...base,
        resultType: "individual_vacancy",
        legacyResultType: "vacancy",
        classificationReason: extracted.reason,
        classificationConfidence: extracted.confidence,
        employerName: extracted.employerName,
        vacancyTitle: extracted.vacancyTitle ?? title,
        officialDomain: domain,
        domainConfidence: domain ? 0.6 : null,
        domainSource: domain ? "vacancy_url" : null,
        shouldResolveEmployer: !domain,
      };
    }
    return {
      ...base,
      resultType: "individual_vacancy",
      legacyResultType: "vacancy",
      classificationReason: "Vacaturetitel zonder betrouwbare werkgever",
      classificationConfidence: 0.88,
      vacancyTitle: title,
      shouldResolveEmployer: true,
    };
  }

  if (isCareersPage(url, title)) {
    const employer = cleanCompanyNameFromTitle(title);
    const domain = resolveOfficialDomain(url);
    return {
      ...base,
      resultType: "company_careers_page",
      legacyResultType: "company_careers_page",
      classificationReason: "Werken-bij/careers pagina van werkgever",
      classificationConfidence: 0.84,
      employerName: employer || null,
      officialDomain: domain,
      domainConfidence: domain ? 0.82 : null,
      domainSource: domain ? "careers_url" : null,
      shouldSaveAsCompany: Boolean(employer && domain),
    };
  }

  const domain = resolveOfficialDomain(url);
  if (domain && !isBlockedOfficialDomain(domain)) {
    const employer = cleanCompanyNameFromTitle(title);
    if (employer && !isLikelyVacancyTitle(employer)) {
      return {
        ...base,
        resultType: "official_company_site",
        legacyResultType: "company",
        classificationReason: "Officiële bedrijfswebsite",
        classificationConfidence: 0.8,
        employerName: employer,
        officialDomain: domain,
        domainConfidence: 0.8,
        domainSource: "result_url",
        shouldSaveAsCompany: true,
      };
    }
  }

  if (url.includes("linkedin.com/company")) {
    const employer = cleanCompanyNameFromTitle(title);
    return {
      ...base,
      resultType: "company_profile",
      legacyResultType: "company",
      classificationReason: "LinkedIn bedrijfsprofiel",
      classificationConfidence: 0.75,
      employerName: employer || null,
      shouldSaveAsCompany: Boolean(employer),
    };
  }

  return {
    ...base,
    resultType: "unknown",
    legacyResultType: "unknown",
    classificationReason: "Onvoldoende bewijs voor bedrijf of vacature",
    classificationConfidence: 0.55,
  };
}

/** Backward-compatible wrapper for existing callers. */
export function classifySearchResult(input: {
  title: string;
  url: string;
  description?: string | null;
}): {
  resultType: ProspectResultType;
  classificationReason: string;
  classificationConfidence: number;
  employerName: string | null;
  vacancyTitle: string | null;
  shouldSaveAsCompany: boolean;
} {
  const classified = classifyDiscoveryResult(input);
  return {
    resultType: classified.legacyResultType,
    classificationReason: classified.classificationReason,
    classificationConfidence: classified.classificationConfidence,
    employerName: classified.employerName,
    vacancyTitle: classified.vacancyTitle,
    shouldSaveAsCompany: classified.shouldSaveAsCompany,
  };
}

export type ClassifiedSearchResult = ReturnType<typeof classifySearchResult>;
