import "server-only";

import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import {
  discoverCareersPageUrls,
  parseCareersPageVacancies,
  type ParsedCareerVacancy,
} from "@/features/ai-recruiter/services/careers-vacancy-parser.service";
import {
  findMatchingDesiredRoles,
  vacancyTitleMatchesDesiredRoles,
} from "@/features/ai-recruiter/services/desired-role-matching.service";
import {
  buildDiscoveryVacancyEvidenceFromCompany,
  dedupeVacancyEvidence,
  parsedVacanciesToEvidence,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";
import type { VacancyAuditStatus } from "@/features/ai-recruiter/services/vacancy-audit-status.service";
import { fetchHomepageHtml } from "@/features/company-finder/discovery/homepage-signals";
import { getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";
import {
  classifyVacancyVerification,
  type VacancyHint,
  type VacancyVerificationTier,
} from "@/features/ai-recruiter/services/vacancy-verification-classifier.service";

export type VacancyValidationStatus =
  | "accepted"
  | "needs_investigation"
  | "insufficient_evidence"
  | "no_active_vacancy"
  | "no_matching_role"
  | "not_required";

export type VacancyValidationResult = {
  status: VacancyValidationStatus;
  vacancies: VacancyEvidence[];
  message: string;
  careersUrlsChecked: string[];
  auditStatus: VacancyAuditStatus;
  parsedVacancyCount: number;
  verificationTier: VacancyVerificationTier;
  hints: VacancyHint[];
  /** Strict confirmed vacancy count — hints are never counted here. */
  confirmedVacancyCount: number;
};

function companyDomain(company: Company): string {
  if (company.domain) return company.domain.toLowerCase().replace(/^www\./, "");
  try {
    const website = company.website ?? company.sourceUrl;
    if (!website) return "";
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function companyWebsite(company: Company): string | null {
  const website = company.website ?? company.sourceUrl;
  if (!website) return null;
  return website.startsWith("http") ? website : `https://${website}`;
}

export function assessVacancyEvidence(input: {
  company: Company;
  plan: AiRecruiterSearchPlan;
  parsedVacancies: ParsedCareerVacancy[];
  preservedDiscoveryEvidence?: VacancyEvidence[];
  evidenceSource: string;
}): VacancyValidationResult {
  const { company, plan, parsedVacancies, evidenceSource } = input;

  if (!plan.vacancy_required) {
    return {
      status: "not_required",
      vacancies: [],
      message: "Vacaturevalidatie niet vereist voor deze run.",
      careersUrlsChecked: [],
      auditStatus: "none",
      parsedVacancyCount: 0,
      verificationTier: "insufficient_evidence",
      hints: [],
      confirmedVacancyCount: 0,
    };
  }

  const activeParsed = parsedVacancies.filter((vacancy) => vacancy.isActive);
  const parsedVacancyCount = activeParsed.length;
  const crawlEvidence = parsedVacanciesToEvidence(activeParsed, company, plan, "careers_page_crawl");
  const discoveryEvidence = input.preservedDiscoveryEvidence ?? [];
  const evidence = dedupeVacancyEvidence([...discoveryEvidence, ...crawlEvidence]).filter(strictVacancyEvidence);

  if (evidence.length === 0) {
  if (parsedVacancyCount > 0) {
      const classified = classifyVacancyVerification({
        strictEvidence: [],
        parsedVacancyCount,
        company,
        roleMismatchConfirmed: false,
      });
      return {
        status: "no_active_vacancy",
        vacancies: [],
        message:
          "Geen concrete actieve vacatures — alleen ruis of afdelingslabels op de careers-pagina.",
        careersUrlsChecked: [],
        auditStatus: "noise",
        parsedVacancyCount,
        verificationTier: classified.tier,
        hints: classified.hints,
        confirmedVacancyCount: 0,
      };
    }

    const classified = classifyVacancyVerification({
      strictEvidence: [],
      parsedVacancyCount,
      company,
      roleMismatchConfirmed: false,
    });

    const status: VacancyValidationStatus =
      classified.tier === "insufficient_evidence"
        ? "insufficient_evidence"
        : "needs_investigation";

    return {
      status,
      vacancies: [],
      message: classified.message,
      careersUrlsChecked: [],
      auditStatus: "none",
      parsedVacancyCount,
      verificationTier: classified.tier,
      hints: classified.hints,
      confirmedVacancyCount: 0,
    };
  }

  if (plan.desired_roles.length > 0) {
    const matching = evidence.filter((vacancy) => vacancyTitleMatchesDesiredRoles(vacancy.title, plan));
    if (matching.length === 0) {
      const foundTitles = evidence.map((vacancy) => vacancy.title).join(", ");
      const classified = classifyVacancyVerification({
        strictEvidence: evidence,
        parsedVacancyCount,
        company,
        roleMismatchConfirmed: true,
      });
      return {
        status: "no_matching_role",
        vacancies: evidence,
        message: `Vacatures gevonden (${foundTitles}), maar geen match met gewenste rollen.`,
        careersUrlsChecked: [],
        auditStatus: "no_matching_role",
        parsedVacancyCount,
        verificationTier: classified.tier,
        hints: classified.hints,
        confirmedVacancyCount: evidence.length,
      };
    }

    return {
      status: "accepted",
      vacancies: matching,
      message: `Actieve vacature(s) gevonden: ${matching.map((vacancy) => vacancy.title).join(", ")}.`,
      careersUrlsChecked: [],
      auditStatus: "matched",
      parsedVacancyCount,
      verificationTier: "confirmed_active",
      hints: [],
      confirmedVacancyCount: matching.length,
    };
  }

  return {
    status: "accepted",
    vacancies: evidence,
    message: `Actieve vacature(s) gevonden: ${evidence.map((vacancy) => vacancy.title).join(", ")}.`,
    careersUrlsChecked: [],
    auditStatus: "found",
    parsedVacancyCount,
    verificationTier: "confirmed_active",
    hints: [],
    confirmedVacancyCount: evidence.length,
  };
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  try {
    return await fetchHomepageHtml(url, timeoutMs);
  } catch {
    return null;
  }
}

export async function validateCompanyVacancies(input: {
  company: Company;
  plan: AiRecruiterSearchPlan;
  timeoutMs?: number;
}): Promise<VacancyValidationResult> {
  const { company, plan } = input;
  const timeoutMs = input.timeoutMs ?? getLeadIntelligenceConfig().crawlerTimeoutMs;

  if (!plan.vacancy_required) {
    return assessVacancyEvidence({
      company,
      plan,
      parsedVacancies: [],
      evidenceSource: "not_required",
    });
  }

  const preservedDiscoveryEvidence = buildDiscoveryVacancyEvidenceFromCompany(company, plan);
  const website = companyWebsite(company);

  if (!website && preservedDiscoveryEvidence.length === 0) {
    const classified = classifyVacancyVerification({
      strictEvidence: [],
      parsedVacancyCount: 0,
      company,
      roleMismatchConfirmed: false,
    });
    return {
      status: "needs_investigation",
      vacancies: [],
      message: classified.message,
      careersUrlsChecked: [],
      auditStatus: "none",
      parsedVacancyCount: 0,
      verificationTier: classified.tier,
      hints: classified.hints,
      confirmedVacancyCount: 0,
    };
  }

  const domain = companyDomain(company);
  const homepageHtml = website ? await fetchHtml(website, timeoutMs) : null;
  const careersCandidates = new Set<string>();

  if (company.careersUrl) careersCandidates.add(company.careersUrl);
  if (company.vacancyPageUrl && !hasConcreteJobUrl(company.vacancyPageUrl)) {
    careersCandidates.add(company.vacancyPageUrl);
  }
  if (company.vacancyPageUrl && hasConcreteJobUrl(company.vacancyPageUrl)) {
    careersCandidates.add(company.vacancyPageUrl);
  }
  if (homepageHtml && website) {
    for (const url of discoverCareersPageUrls(homepageHtml, website)) {
      careersCandidates.add(url);
    }
  }

  const careersUrlsChecked = [...careersCandidates];
  const parsedVacancies: ParsedCareerVacancy[] = [];

  for (const careersUrl of careersUrlsChecked) {
    const careersHtml = careersUrl === website ? homepageHtml : await fetchHtml(careersUrl, timeoutMs);
    if (!careersHtml) continue;
    parsedVacancies.push(...parseCareersPageVacancies(careersHtml, careersUrl, domain));
  }

  const uniqueParsed = parsedVacancies.filter((vacancy, index, all) =>
    all.findIndex((entry) => entry.title.toLowerCase() === vacancy.title.toLowerCase() && entry.url === vacancy.url) === index,
  );

  const result = assessVacancyEvidence({
    company,
    plan,
    parsedVacancies: uniqueParsed,
    preservedDiscoveryEvidence,
    evidenceSource: "careers_page_crawl",
  });

  return {
    ...result,
    careersUrlsChecked,
  };
}

/** @deprecated Use assessVacancyEvidence */
export function assessParsedVacancies(input: {
  company: Company;
  plan: AiRecruiterSearchPlan;
  parsedVacancies: ParsedCareerVacancy[];
  evidenceSource: string;
}): VacancyValidationResult {
  return assessVacancyEvidence(input);
}

export function primaryMatchedRole(vacancies: VacancyEvidence[], plan: AiRecruiterSearchPlan): string | null {
  for (const vacancy of vacancies) {
    const matches = findMatchingDesiredRoles(vacancy.title, plan);
    if (matches[0]) return matches[0];
  }
  return vacancies[0]?.title ?? null;
}
