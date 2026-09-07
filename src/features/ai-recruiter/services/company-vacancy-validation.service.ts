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
  dedupeVacancyEvidence,
  parsedVacanciesToEvidence,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { fetchHomepageHtml } from "@/features/company-finder/discovery/homepage-signals";
import { getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";

export type VacancyValidationStatus =
  | "accepted"
  | "no_active_vacancy"
  | "no_matching_role"
  | "not_required";

export type VacancyValidationResult = {
  status: VacancyValidationStatus;
  vacancies: VacancyEvidence[];
  message: string;
  careersUrlsChecked: string[];
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

export function assessParsedVacancies(input: {
  company: Company;
  plan: AiRecruiterSearchPlan;
  parsedVacancies: ParsedCareerVacancy[];
  evidenceSource: string;
}): VacancyValidationResult {
  const { company, plan, parsedVacancies, evidenceSource } = input;

  if (!plan.vacancy_required) {
    return {
      status: "not_required",
      vacancies: [],
      message: "Vacaturevalidatie niet vereist voor deze run.",
      careersUrlsChecked: [],
    };
  }

  const activeParsed = parsedVacancies.filter((vacancy) => vacancy.isActive);
  const evidence = dedupeVacancyEvidence(
    parsedVacanciesToEvidence(activeParsed, company, evidenceSource),
  ).filter(strictVacancyEvidence);

  if (evidence.length === 0) {
    return {
      status: "no_active_vacancy",
      vacancies: [],
      message: "Geen actuele vacature gevonden op de careers-pagina.",
      careersUrlsChecked: [],
    };
  }

  if (plan.desired_roles.length > 0) {
    const matching = evidence.filter((vacancy) => vacancyTitleMatchesDesiredRoles(vacancy.title, plan));
    if (matching.length === 0) {
      const foundTitles = evidence.map((vacancy) => vacancy.title).join(", ");
      return {
        status: "no_matching_role",
        vacancies: evidence,
        message: `Vacatures gevonden (${foundTitles}), maar geen match met gewenste rollen.`,
        careersUrlsChecked: [],
      };
    }

    return {
      status: "accepted",
      vacancies: matching,
      message: `Actieve vacature(s) gevonden: ${matching.map((vacancy) => vacancy.title).join(", ")}.`,
      careersUrlsChecked: [],
    };
  }

  return {
    status: "accepted",
    vacancies: evidence,
    message: `Actieve vacature(s) gevonden: ${evidence.map((vacancy) => vacancy.title).join(", ")}.`,
    careersUrlsChecked: [],
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
    return assessParsedVacancies({
      company,
      plan,
      parsedVacancies: [],
      evidenceSource: "not_required",
    });
  }

  const website = companyWebsite(company);
  if (!website) {
    return {
      status: "no_active_vacancy",
      vacancies: [],
      message: "Geen bedrijfswebsite beschikbaar voor vacaturevalidatie.",
      careersUrlsChecked: [],
    };
  }

  const domain = companyDomain(company);
  const homepageHtml = await fetchHtml(website, timeoutMs);
  const careersCandidates = new Set<string>();

  if (company.careersUrl) careersCandidates.add(company.careersUrl);
  if (company.vacancyPageUrl) careersCandidates.add(company.vacancyPageUrl);
  if (homepageHtml) {
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

  const result = assessParsedVacancies({
    company,
    plan,
    parsedVacancies: uniqueParsed,
    evidenceSource: "careers_page_crawl",
  });

  return {
    ...result,
    careersUrlsChecked,
  };
}

export function primaryMatchedRole(vacancies: VacancyEvidence[], plan: AiRecruiterSearchPlan): string | null {
  for (const vacancy of vacancies) {
    const matches = findMatchingDesiredRoles(vacancy.title, plan);
    if (matches[0]) return matches[0];
  }
  return vacancies[0]?.title ?? null;
}
