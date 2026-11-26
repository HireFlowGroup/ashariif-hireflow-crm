import type { Company } from "@/features/companies/domain";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import {
  isGenericVacancyTitle,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";

export type VacancyVerificationTier =
  | "confirmed_active"
  | "possible_match_needs_investigation"
  | "irrelevant_vacancy"
  | "insufficient_evidence";

export type VacancyHint = {
  title: string | null;
  url: string | null;
  source: "discovery_nav" | "hiring_signal" | "careers_noise";
  message: string;
};

export function collectVacancyHintsFromCompany(company: Company): VacancyHint[] {
  const hints: VacancyHint[] = [];

  if (company.vacancyPageUrl && !hasConcreteJobUrl(company.vacancyPageUrl)) {
    hints.push({
      title: null,
      url: company.vacancyPageUrl,
      source: "discovery_nav",
      message: "Careers- of vacaturenavigatie gevonden zonder concrete job-URL",
    });
  }

  if (company.careersUrl) {
    hints.push({
      title: null,
      url: company.careersUrl,
      source: "discovery_nav",
      message: "Careers-URL bekend — verificatie op detailniveau vereist",
    });
  }

  for (const signal of company.hiringSignals) {
    if (signal.type !== "active_vacancy" && signal.type !== "vacancy") continue;
    const title = signal.description?.trim() ?? "";
    if (!title || isGenericVacancyTitle(title)) {
      hints.push({
        title: title || null,
        url: company.vacancyPageUrl ?? company.website ?? null,
        source: "hiring_signal",
        message: "Vacaturehint in hiring signal — geen bevestigde vacature",
      });
      continue;
    }
    const jobUrl = company.vacancyPageUrl;
    if (!jobUrl || !hasConcreteJobUrl(jobUrl)) {
      hints.push({
        title,
        url: jobUrl ?? null,
        source: "hiring_signal",
        message: `Mogelijke rol "${title}" zonder concrete job-URL`,
      });
    }
  }

  return hints;
}

export function classifyVacancyVerification(input: {
  strictEvidence: VacancyEvidence[];
  parsedVacancyCount: number;
  company: Company;
  roleMismatchConfirmed: boolean;
}): { tier: VacancyVerificationTier; hints: VacancyHint[]; message: string } {
  const confirmed = input.strictEvidence.filter(strictVacancyEvidence);
  if (confirmed.length > 0) {
    return {
      tier: "confirmed_active",
      hints: [],
      message: `Bevestigde vacature(s): ${confirmed.map((v) => v.jobTitle).join(", ")}`,
    };
  }

  if (input.roleMismatchConfirmed) {
    return {
      tier: "irrelevant_vacancy",
      hints: [],
      message: "Vacatures gevonden maar geen match met gewenste rollen",
    };
  }

  const hints = collectVacancyHintsFromCompany(input.company);
  if (hints.length > 0) {
    return {
      tier: "possible_match_needs_investigation",
      hints,
      message: "Vacaturehint — aanvullend onderzoek vereist voordat afwijzing",
    };
  }

  if (input.parsedVacancyCount > 0) {
    return {
      tier: "possible_match_needs_investigation",
      hints: [
        {
          title: null,
          url: input.company.vacancyPageUrl ?? input.company.careersUrl,
          source: "careers_noise",
          message: "Careers-pagina bevat tekst, maar geen concrete vacaturebewijzen",
        },
      ],
      message: "Mogelijke vacature op careers-pagina — nader onderzoek nodig",
    };
  }

  const hasWebsite = Boolean(input.company.website ?? input.company.sourceUrl);
  if (!hasWebsite) {
    return {
      tier: "insufficient_evidence",
      hints: [],
      message: "Onvoldoende vacaturebewijs — geen website voor verificatie",
    };
  }

  return {
    tier: "insufficient_evidence",
    hints: [],
    message: "Geen bevestigde vacature na website-onderzoek",
  };
}