import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";

export type HiringIntelligenceProfile = {
  hiringScore: number;
  breakdown: Record<string, number>;
  explanations: string[];
  signals: Array<{
    type: string;
    title: string;
    description: string | null;
    source: string;
    observedAt: string | null;
  }>;
  vacancyCount: number;
  vacancyTitles: string[];
  careersUrl: string | null;
  warnings: string[];
};

export function computeHiringIntelligenceProfile(
  company: Company,
  plan: AiRecruiterSearchPlan,
): HiringIntelligenceProfile {
  const breakdown: Record<string, number> = {
    multiple_vacancies: 0,
    relevant_roles: 0,
    recent_hiring_signal: 0,
    careers_page: 0,
    growth_signal: 0,
    contact_info: 0,
    target_match: 0,
  };
  const explanations: string[] = [];
  const warnings: string[] = [];

  const vacancyCount = company.vacancyCount ?? 0;
  const vacancyTitles: string[] = [];

  if (vacancyCount >= 2) {
    breakdown.multiple_vacancies = 30;
    explanations.push(`${vacancyCount} actuele vacatures gevonden.`);
  } else if (vacancyCount === 1) {
    breakdown.multiple_vacancies = 15;
    explanations.push("1 actuele vacature gevonden.");
  } else if (plan.vacancy_required) {
    warnings.push("Vacature vereist maar geen vacatures gevonden.");
  }

  const roleMatches = plan.desired_roles.filter((role) => {
    const lower = role.toLowerCase();
    return company.hiringSignals.some((s) => s.description.toLowerCase().includes(lower));
  });

  if (roleMatches.length > 0) {
    breakdown.relevant_roles = 15;
    explanations.push(`Relevante functies: ${roleMatches.join(", ")}.`);
  }

  const recentSignal = company.hiringSignals[0];
  if (recentSignal) {
    breakdown.recent_hiring_signal = 15;
    explanations.push(`Recent signaal: ${recentSignal.description}`);
  }

  if (company.careersUrl || company.vacancyPageUrl) {
    breakdown.careers_page = 10;
    explanations.push("Werken-bij-pagina aanwezig.");
  }

  const growthTypes = ["growth", "expansion", "funding", "new_office"];
  if (company.hiringSignals.some((s) => growthTypes.some((t) => s.type.includes(t)))) {
    breakdown.growth_signal = 10;
    explanations.push("Groei- of uitbreidingssignaal gedetecteerd.");
  }

  if (company.hrEmail || company.generalEmail || company.email) {
    breakdown.contact_info = 10;
    explanations.push("Zakelijke contactinformatie beschikbaar.");
  }

  if (plan.sectors.length === 0 || (company.sector && plan.sectors.some((s) => company.sector!.toLowerCase().includes(s.toLowerCase())))) {
    breakdown.target_match = 10;
    explanations.push("Match met doelgroep HireFlow.");
  }

  const hiringScore = Math.min(
    100,
    Object.values(breakdown).reduce((sum, v) => sum + v, 0),
  );

  const signals = company.hiringSignals.map((s) => ({
    type: s.type,
    title: s.description.slice(0, 80),
    description: s.description,
    source: s.source,
    observedAt: null,
  }));

  return {
    hiringScore,
    breakdown,
    explanations,
    signals,
    vacancyCount,
    vacancyTitles,
    careersUrl: company.careersUrl ?? company.vacancyPageUrl,
    warnings,
  };
}
