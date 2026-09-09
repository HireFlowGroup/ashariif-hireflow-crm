import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type {
  VacancyActiveStatus,
  VacancyEvidence,
  VacancyEvidenceSourceType,
} from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { ClassifiedSearchResult } from "@/features/company-finder/discovery/result-classifier.service";
import { vacancyTitleMatchesDesiredRoles } from "@/features/ai-recruiter/services/desired-role-matching.service";
import type { ParsedCareerVacancy } from "@/features/ai-recruiter/services/careers-vacancy-parser.service";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";

export { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";

const GENERIC_VACANCY_TITLES = new Set([
  "careers pagina",
  "open vacature",
  "recruitment opportunity",
  "recruitmentfunctie",
  "vacatures",
  "careers",
  "jobs",
  "werken bij",
  "recruiters",
  "recruiter",
  "accountmanagers",
  "accountmanager",
  "customer success managers",
]);

function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isGenericVacancyTitle(title: string): boolean {
  return GENERIC_VACANCY_TITLES.has(normalizeTitle(title));
}

export function createVacancyEvidence(input: {
  companyName: string | null;
  companyDomain: string;
  jobTitle: string;
  jobUrl: string;
  sourceUrl: string;
  sourceType: VacancyEvidenceSourceType;
  location?: string | null;
  observedAt?: string;
  activeStatus?: VacancyActiveStatus;
  desiredRoleMatch: boolean;
  validationReason: string;
  hiringSignalStrength?: number;
}): VacancyEvidence {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const activeStatus = input.activeStatus ?? "active";
  const jobDomain = extractDomain(input.jobUrl) || input.companyDomain;

  return {
    companyName: input.companyName,
    companyDomain: input.companyDomain,
    jobTitle: input.jobTitle,
    jobUrl: input.jobUrl,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    location: input.location ?? null,
    observedAt,
    activeStatus,
    desiredRoleMatch: input.desiredRoleMatch,
    title: input.jobTitle,
    sourceDomain: jobDomain,
    publishedAt: null,
    validThrough: null,
    employmentType: null,
    department: null,
    hiringSignalStrength: input.hiringSignalStrength ?? 70,
    isActive: activeStatus === "active",
    validationReason: input.validationReason,
    actuality: activeStatus === "active" ? "known" : "unknown",
  };
}

export function strictVacancyEvidence(evidence: VacancyEvidence): boolean {
  const title = evidence.jobTitle || evidence.title;
  const jobUrl = evidence.jobUrl || evidence.sourceUrl;

  return (
    evidence.activeStatus !== "inactive"
    && evidence.isActive
    && title.trim().length > 2
    && !isGenericVacancyTitle(title)
    && hasConcreteJobUrl(jobUrl)
    && Boolean(evidence.companyDomain)
    && Boolean(evidence.validationReason)
    && evidence.sourceType !== "crm_record"
  );
}

export function parsedVacanciesToEvidence(
  parsed: ParsedCareerVacancy[],
  company: Company,
  plan: AiRecruiterSearchPlan,
  evidenceSource: VacancyEvidenceSourceType,
): VacancyEvidence[] {
  const domain = company.domain ?? extractDomain(company.website ?? company.sourceUrl);

  return parsed.map((vacancy) =>
    createVacancyEvidence({
      companyName: company.name,
      companyDomain: domain,
      jobTitle: vacancy.title,
      jobUrl: vacancy.url,
      sourceUrl: vacancy.url,
      sourceType: evidenceSource,
      location: company.city,
      activeStatus: vacancy.isActive ? "active" : "inactive",
      desiredRoleMatch: vacancyTitleMatchesDesiredRoles(vacancy.title, plan),
      validationReason: `${evidenceSource}: ${vacancy.inactiveReason ?? "Actieve vacature op careers-pagina"}`,
      hiringSignalStrength: 70,
    }),
  );
}

function discoveryVacancyTitleFromCompany(company: Company): string | null {
  const signalTitle = company.hiringSignals.find(
    (signal) => signal.type === "active_vacancy" || signal.type === "vacancy",
  )?.description;
  if (signalTitle?.trim()) return signalTitle.trim();
  return null;
}

/** Build strict discovery evidence preserved on the company record from discovery. */
export function buildDiscoveryVacancyEvidenceFromCompany(
  company: Company,
  plan: AiRecruiterSearchPlan,
): VacancyEvidence[] {
  const domain = company.domain ?? extractDomain(company.website ?? company.sourceUrl);
  const jobUrl = company.vacancyPageUrl ?? null;
  if (!jobUrl || !hasConcreteJobUrl(jobUrl) || !domain) return [];

  const jobTitle = discoveryVacancyTitleFromCompany(company);
  if (!jobTitle || isGenericVacancyTitle(jobTitle)) return [];

  const evidence = createVacancyEvidence({
    companyName: company.name,
    companyDomain: domain,
    jobTitle,
    jobUrl,
    sourceUrl: jobUrl,
    sourceType: "discovery_classification",
    location: company.city,
    desiredRoleMatch: vacancyTitleMatchesDesiredRoles(jobTitle, plan),
    validationReason: "discovery_classification: Concrete vacature gevonden tijdens discovery",
    hiringSignalStrength: 65,
  });

  return strictVacancyEvidence(evidence) ? [evidence] : [];
}

/** Returns only previously validated CRM evidence — never from discovery hints or nav labels. */
export function buildVacancyEvidenceFromCompany(
  company: Company,
  plan: AiRecruiterSearchPlan,
): VacancyEvidence[] {
  return buildDiscoveryVacancyEvidenceFromCompany(company, plan);
}

export function buildVacancyEvidenceFromClassification(
  classification: ClassifiedSearchResult,
  sourceUrl: string,
  plan: AiRecruiterSearchPlan,
  companyDomain: string,
): VacancyEvidence | null {
  if (classification.resultType !== "vacancy" || !classification.vacancyTitle) {
    return null;
  }

  if (isGenericVacancyTitle(classification.vacancyTitle)) return null;
  if (!hasConcreteJobUrl(sourceUrl)) return null;

  return createVacancyEvidence({
    companyName: classification.employerName,
    companyDomain,
    jobTitle: classification.vacancyTitle,
    jobUrl: sourceUrl,
    sourceUrl,
    sourceType: "discovery_classification",
    desiredRoleMatch: vacancyTitleMatchesDesiredRoles(classification.vacancyTitle, plan),
    validationReason: classification.classificationReason,
    hiringSignalStrength: 50,
  });
}

export function desiredRoleMatchesVacancy(
  vacancyTitle: string,
  plan: AiRecruiterSearchPlan,
): boolean {
  if (isGenericVacancyTitle(vacancyTitle)) return false;
  return vacancyTitleMatchesDesiredRoles(vacancyTitle, plan);
}

export function dedupeVacancyEvidence(items: VacancyEvidence[]): VacancyEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const title = item.jobTitle || item.title;
    const jobUrl = item.jobUrl || item.sourceUrl;
    const key = `${normalizeTitle(title)}|${item.companyDomain}|${jobUrl.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function primaryVacancyTitle(evidence: VacancyEvidence[]): string | null {
  return evidence.find((v) => v.isActive && strictVacancyEvidence(v))?.jobTitle ?? null;
}

export function countStrictActiveVacancies(evidence: VacancyEvidence[]): number {
  return evidence.filter((item) => strictVacancyEvidence(item)).length;
}

export function filterStrictVacancyEvidence(evidence: VacancyEvidence[]): VacancyEvidence[] {
  return evidence.filter(strictVacancyEvidence);
}
