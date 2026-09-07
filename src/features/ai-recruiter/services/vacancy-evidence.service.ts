import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { ClassifiedSearchResult } from "@/features/company-finder/discovery/result-classifier.service";
import { vacancyTitleMatchesDesiredRoles } from "@/features/ai-recruiter/services/desired-role-matching.service";
import type { ParsedCareerVacancy } from "@/features/ai-recruiter/services/careers-vacancy-parser.service";

const GENERIC_VACANCY_TITLES = new Set([
  "careers pagina",
  "open vacature",
  "recruitment opportunity",
  "vacatures",
  "careers",
  "jobs",
  "werken bij",
]);

function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
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

export function strictVacancyEvidence(evidence: VacancyEvidence): boolean {
  return (
    evidence.isActive
    && evidence.title.trim().length > 2
    && !isGenericVacancyTitle(evidence.title)
    && Boolean(evidence.sourceUrl)
    && Boolean(evidence.sourceDomain)
    && Boolean(evidence.validationReason)
  );
}

export function parsedVacanciesToEvidence(
  parsed: ParsedCareerVacancy[],
  company: Company,
  evidenceSource: string,
): VacancyEvidence[] {
  const domain = extractDomain(company.website ?? company.sourceUrl);

  return parsed.map((vacancy) => ({
    title: vacancy.title,
    companyName: company.name,
    location: company.city,
    sourceUrl: vacancy.url,
    sourceDomain: extractDomain(vacancy.url) || domain,
    publishedAt: null,
    validThrough: null,
    employmentType: null,
    department: null,
    hiringSignalStrength: 70,
    isActive: vacancy.isActive,
    validationReason: `${evidenceSource}: ${vacancy.inactiveReason ?? "Actieve vacature op careers-pagina"}`,
    actuality: "known" as const,
  }));
}

/** Returns only previously validated CRM evidence with concrete titles and URLs. */
export function buildVacancyEvidenceFromCompany(
  company: Company,
  _plan: AiRecruiterSearchPlan,
): VacancyEvidence[] {
  const evidence: VacancyEvidence[] = [];
  const domain = extractDomain(company.website ?? company.sourceUrl);

  for (const signal of company.hiringSignals.slice(0, 5)) {
    const title = signal.description.slice(0, 120).trim();
    const sourceUrl = company.website ?? company.sourceUrl ?? "";
    if (!title || !sourceUrl || isGenericVacancyTitle(title)) continue;

    evidence.push({
      title,
      companyName: company.name,
      location: company.city,
      sourceUrl,
      sourceDomain: extractDomain(sourceUrl) || domain,
      publishedAt: null,
      validThrough: null,
      employmentType: null,
      department: null,
      hiringSignalStrength: Math.round(signal.confidence * 100),
      isActive: true,
      validationReason: `Hiring signal: ${signal.type}`,
      actuality: "known",
    });
  }

  return evidence.filter(strictVacancyEvidence);
}

export function buildVacancyEvidenceFromClassification(
  classification: ClassifiedSearchResult,
  sourceUrl: string,
): VacancyEvidence | null {
  if (classification.resultType !== "vacancy" || !classification.vacancyTitle) {
    return null;
  }

  return {
    title: classification.vacancyTitle,
    companyName: classification.employerName,
    location: null,
    sourceUrl,
    sourceDomain: extractDomain(sourceUrl),
    publishedAt: null,
    validThrough: null,
    employmentType: null,
    department: null,
    hiringSignalStrength: 50,
    isActive: true,
    validationReason: classification.classificationReason,
    actuality: "known",
  };
}

export function desiredRoleMatchesVacancy(
  vacancyTitle: string,
  plan: AiRecruiterSearchPlan,
): boolean {
  return vacancyTitleMatchesDesiredRoles(vacancyTitle, plan);
}

export function dedupeVacancyEvidence(items: VacancyEvidence[]): VacancyEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${normalizeTitle(item.title)}|${item.sourceDomain}|${normalizeTitle(item.location ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function primaryVacancyTitle(evidence: VacancyEvidence[]): string | null {
  return evidence.find((v) => v.isActive && strictVacancyEvidence(v))?.title ?? null;
}

export function countStrictActiveVacancies(evidence: VacancyEvidence[]): number {
  return evidence.filter((item) => strictVacancyEvidence(item)).length;
}
