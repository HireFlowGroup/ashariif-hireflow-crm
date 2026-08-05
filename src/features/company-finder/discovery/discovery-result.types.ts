/** Discovery result classification and funnel types. */

export const discoveryResultTypeSchema = [
  "official_company_site",
  "company_profile",
  "company_careers_page",
  "individual_vacancy",
  "vacancy_board",
  "business_directory",
  "list_article",
  "news_article",
  "search_result_page",
  "recruitment_agency",
  "unknown",
] as const;

export type DiscoveryResultType = (typeof discoveryResultTypeSchema)[number];

export const discoveryRejectionReasonCodeSchema = [
  "not_a_company",
  "vacancy_title_only",
  "directory",
  "list_article",
  "competitor",
  "wrong_location",
  "wrong_sector",
  "unresolved_employer",
  "no_official_domain",
  "duplicate",
  "insufficient_evidence",
  "invalid_source",
  "other",
] as const;

export type DiscoveryRejectionReasonCode = (typeof discoveryRejectionReasonCodeSchema)[number];

export type DiscoveryResultLogEntry = {
  query: string;
  provider: string;
  resultTitle: string;
  resultUrl: string;
  resultDomain: string;
  snippet: string;
  classifiedType: DiscoveryResultType;
  classificationConfidence: number;
  classificationReason: string;
  extractedCompanyName: string | null;
  extractedEmployer: string | null;
  officialDomain: string | null;
  domainConfidence: number | null;
  domainSource: string | null;
  vacancyTitle: string | null;
  vacancyUrl: string | null;
  excludedCompetitor: boolean;
  accepted: boolean;
  rejectionReason: DiscoveryRejectionReasonCode | null;
};

export type DiscoveryFunnelMetrics = {
  queriesExecuted: number;
  rawResults: number;
  uniqueUrls: number;
  officialCompanySites: number;
  vacancyResults: number;
  directories: number;
  listArticles: number;
  newsArticles: number;
  competitorsExcluded: number;
  realCompanies: number;
  companiesInRegion: number;
  companiesInSector: number;
  withVacancyEvidence: number;
  withoutVacancyEvidence: number;
  saved: number;
  rejected: number;
};

export type EnrichedDiscoveryResult = {
  title: string;
  url: string;
  description?: string | null;
  query: string;
  resultType: DiscoveryResultType;
  classificationConfidence: number;
  classificationReason: string;
  extractedCompanyName: string | null;
  extractedEmployer: string | null;
  officialDomain: string | null;
  domainConfidence: number | null;
  domainSource: string | null;
  vacancyTitle: string | null;
  vacancyUrl: string | null;
  vacancySource: string | null;
  excludedCompetitor: boolean;
  accepted: boolean;
  rejectionReason: DiscoveryRejectionReasonCode | null;
};
