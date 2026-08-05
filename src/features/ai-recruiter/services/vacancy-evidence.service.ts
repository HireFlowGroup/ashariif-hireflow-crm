import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { ClassifiedSearchResult } from "@/features/company-finder/discovery/result-classifier.service";

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

export function buildVacancyEvidenceFromCompany(
  company: Company,
  plan: AiRecruiterSearchPlan,
): VacancyEvidence[] {
  const evidence: VacancyEvidence[] = [];
  const domain = extractDomain(company.website ?? company.sourceUrl);
  const vacancyCount = company.vacancyCount ?? 0;

  if (vacancyCount > 0) {
    evidence.push({
      title: plan.desired_roles[0] ?? "Open vacature",
      companyName: company.name,
      location: company.city,
      sourceUrl: company.website ?? company.sourceUrl ?? "",
      sourceDomain: domain,
      publishedAt: null,
      validThrough: null,
      employmentType: null,
      department: null,
      hiringSignalStrength: Math.min(100, vacancyCount * 20),
      isActive: true,
      validationReason: `${vacancyCount} vacature(s) bekend in CRM/signalen`,
      actuality: "unknown",
    });
  }

  if (company.careersUrl || company.vacancyPageUrl) {
    evidence.push({
      title: "Careers pagina",
      companyName: company.name,
      location: company.city,
      sourceUrl: company.careersUrl ?? company.vacancyPageUrl ?? "",
      sourceDomain: extractDomain(company.careersUrl ?? company.vacancyPageUrl),
      publishedAt: null,
      validThrough: null,
      employmentType: null,
      department: null,
      hiringSignalStrength: 60,
      isActive: true,
      validationReason: "Werken-bij pagina gevonden",
      actuality: "unknown",
    });
  }

  for (const signal of company.hiringSignals.slice(0, 5)) {
    evidence.push({
      title: signal.description.slice(0, 120),
      companyName: company.name,
      location: company.city,
      sourceUrl: company.website ?? company.sourceUrl ?? "",
      sourceDomain: domain,
      publishedAt: null,
      validThrough: null,
      employmentType: null,
      department: null,
      hiringSignalStrength: Math.round(signal.confidence * 100),
      isActive: true,
      validationReason: `Hiring signal: ${signal.type}`,
      actuality: "unknown",
    });
  }

  if (evidence.length === 0 && company.discoveryReason?.toLowerCase().includes("vacature")) {
    evidence.push({
      title: plan.desired_roles[0] ?? "Recruitment opportunity",
      companyName: company.name,
      location: company.city,
      sourceUrl: company.sourceUrl ?? company.website ?? "",
      sourceDomain: domain,
      publishedAt: null,
      validThrough: null,
      employmentType: null,
      department: null,
      hiringSignalStrength: 40,
      isActive: true,
      validationReason: "Aannemelijke vacature-intentie via discovery",
      actuality: "unknown",
    });
  }

  return evidence;
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
    actuality: "unknown",
  };
}

export function desiredRoleMatchesVacancy(
  vacancyTitle: string,
  plan: AiRecruiterSearchPlan,
): boolean {
  if (plan.desired_roles.length === 0) return false;
  const normalized = normalizeTitle(vacancyTitle);
  return plan.desired_roles.some((role) => normalized.includes(normalizeTitle(role)));
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
  return evidence.find((v) => v.isActive)?.title ?? evidence[0]?.title ?? null;
}
