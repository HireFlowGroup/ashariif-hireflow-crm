import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  assessRecruitmentPotentialFromCompany,
  type RecruitmentPotential,
} from "@/features/company-intelligence/services/recruitment-potential.service";

export type OpportunityUrgency = "high" | "medium" | "low";

export type OpportunityAssessment = {
  opportunityScore: number;
  agencyNeedLikelihood: "high" | "medium" | "low";
  recruitmentPotential: RecruitmentPotential;
  recruitmentPotentialMotivation: string;
  why: string[];
  rolesSought: string[];
  urgency: OpportunityUrgency;
  bestApproach: string;
  breakdown: {
    growth: number;
    multipleVacancies: number;
    noInternalRecruiter: number;
    staleVacancies: number;
    scalability: number;
  };
};

const GROWTH_SIGNAL_TYPES = ["growth", "expansion", "funding", "new_office", "scale"];
const INTERNAL_RECRUITER_SIGNALS = ["new_recruiter", "internal_recruiter", "ta_team", "recruitment_team"];
const STALE_SIGNAL_TYPES = ["stale_vacancy", "long_open_vacancy", "vacancy_30_days"];

const RECRUITER_ROLE_KEYWORDS = [
  "recruiter",
  "recruitment",
  "talent acquisition",
  "wervings",
  "hr manager",
  "hr business partner",
];


function hasGrowthSignal(company: Company): boolean {
  return company.hiringSignals.some(
    (s) =>
      GROWTH_SIGNAL_TYPES.some((t) => s.type.toLowerCase().includes(t))
      || /groei|uitbreid|scale-up|funding|investering|nieuw kantoor/i.test(s.description),
  );
}

function hasInternalRecruiterSignal(company: Company): boolean {
  return company.hiringSignals.some(
    (s) =>
      INTERNAL_RECRUITER_SIGNALS.some((t) => s.type.toLowerCase().includes(t))
      || /interne recruiter|recruitment team|talent acquisition team|inhouse recruiter/i.test(s.description),
  );
}

function hasStaleVacancySignal(company: Company): boolean {
  return company.hiringSignals.some((s) => {
    if (STALE_SIGNAL_TYPES.some((t) => s.type.toLowerCase().includes(t))) return true;
    return /(\d{2,}|\b30\+?\b)\s*dagen|lang open|al weken|stale|openstaand sinds/i.test(s.description);
  });
}

function extractRolesSought(company: Company, plan: AiRecruiterSearchPlan): string[] {
  const roles = new Set<string>();

  for (const role of plan.desired_roles) {
    const lower = role.toLowerCase();
    if (
      company.hiringSignals.some((s) => s.description.toLowerCase().includes(lower))
      || (company.aiSummary?.toLowerCase().includes(lower) ?? false)
    ) {
      roles.add(role);
    }
  }

  for (const signal of company.hiringSignals) {
    for (const keyword of RECRUITER_ROLE_KEYWORDS) {
      if (signal.description.toLowerCase().includes(keyword)) {
        const match = signal.description.match(/(?:zoekt|vacature|hiring|op zoek naar)[:\s]+([^.]{3,60})/i);
        if (match?.[1]) roles.add(match[1].trim());
      }
    }
  }

  if (roles.size === 0 && company.vacancyCount > 0) {
    roles.add(`${company.vacancyCount} openstaande vacature(s)`);
  }

  return [...roles].slice(0, 6);
}

function scoreScalability(company: Company): number {
  const max = company.employeeCountMax ?? company.employeeCount;
  const min = company.employeeCountMin ?? company.employeeCount;
  const size = max ?? min;

  if (size === null) return 4;
  if (size >= 20 && size <= 500) return 10;
  if (size >= 10 && size <= 750) return 6;
  return 2;
}

function scoreNoInternalRecruiter(company: Company): number {
  if (hasInternalRecruiterSignal(company)) return 0;

  const vacancies = company.vacancyCount ?? 0;
  const hiringRecruiterRoles = company.hiringSignals.some((s) =>
    /recruiter|talent acquisition|recruitment manager|hr manager/i.test(s.description),
  );

  if (vacancies >= 2 && !hasInternalRecruiterSignal(company)) return 20;
  if (hiringRecruiterRoles) return 15;
  if (vacancies >= 1 && (company.employeeCountMax ?? 200) <= 200) return 12;
  if (vacancies >= 1) return 8;

  return 0;
}

function deriveUrgency(
  score: number,
  staleVacancies: boolean,
  vacancyCount: number,
): OpportunityUrgency {
  if (staleVacancies || (vacancyCount >= 3 && score >= 70)) return "high";
  if (score >= 70 || vacancyCount >= 2) return "medium";
  return "low";
}

function deriveBestApproach(
  breakdown: OpportunityAssessment["breakdown"],
  company: Company,
): string {
  if (breakdown.staleVacancies >= 15) {
    return `Benader met focus op versnelling: open vacatures lijken langer open te staan — bied ondersteuning bij ${company.name} aan zonder interne TA-capaciteit op te bouwen.`;
  }
  if (breakdown.multipleVacancies >= 20) {
    return `Meerdere parallelle vacatures — positioneer HireFlow als schaalbare recruitmentpartner i.p.v. ad-hoc sollicitanten.`;
  }
  if (breakdown.noInternalRecruiter >= 15) {
    return `Geen zichtbare interne recruiter — benader commercieel: flexibele recruitment-ondersteuning zonder vaste FTE.`;
  }
  if (breakdown.growth >= 15) {
    return `Groeiorganisatie — koppel recruitment-ondersteuning aan schaalbaarheid en snellere hiring.`;
  }
  return `Algemene kennismaking: vraag of externe recruitment-ondersteuning past bij de huidige hiringdruk.`;
}

export function computeOpportunityAssessment(
  company: Company,
  plan: AiRecruiterSearchPlan,
): OpportunityAssessment {
  const why: string[] = [];
  const vacancyCount = company.vacancyCount ?? 0;

  let growth = 0;
  if (hasGrowthSignal(company)) {
    growth = 25;
    why.push("Groei- of uitbreidingssignaal — waarschijnlijk toenemende hiringdruk.");
  } else if ((company.employeeCountMax ?? 0) >= 50) {
    growth = 10;
    why.push("Organisatie lijkt schaalbaar op basis van bedrijfsomvang.");
  }

  let multipleVacancies = 0;
  if (vacancyCount >= 3) {
    multipleVacancies = 25;
    why.push(`${vacancyCount} openstaande vacatures — hoge kans op capaciteitsprobleem.`);
  } else if (vacancyCount === 2) {
    multipleVacancies = 20;
    why.push("Twee openstaande vacatures — parallelle hiring vraagt vaak om ondersteuning.");
  } else if (vacancyCount === 1) {
    multipleVacancies = 10;
    why.push("Eén open vacature — beperkte maar concrete hiringbehoefte.");
  } else {
    why.push("Geen actuele vacatures zichtbaar — lagere kans op directe opdracht.");
  }

  const noInternalRecruiter = scoreNoInternalRecruiter(company);
  if (noInternalRecruiter >= 15) {
    why.push("Geen interne recruiter/TA-team zichtbaar — externe ondersteuning waarschijnlijk nodig.");
  } else if (noInternalRecruiter === 0 && hasInternalRecruiterSignal(company)) {
    why.push("Intern recruitment/signaal aanwezig — lagere kans op bureau-opdracht.");
  }

  let staleVacancies = 0;
  if (hasStaleVacancySignal(company)) {
    staleVacancies = 20;
    why.push("Vacatures lijken langer dan 30 dagen open — urgentie en behoefte aan versnelling.");
  }

  const scalability = scoreScalability(company);
  if (scalability >= 10) {
    why.push("Bedrijfsomvang past bij schaalbare recruitmentopdrachten (20–500 FTE sweet spot).");
  }

  const opportunityScore = Math.min(
    100,
    growth + multipleVacancies + noInternalRecruiter + staleVacancies + scalability,
  );

  const agencyNeedLikelihood: OpportunityAssessment["agencyNeedLikelihood"] =
    opportunityScore >= 75 ? "high" : opportunityScore >= 55 ? "medium" : "low";

  const rolesSought = extractRolesSought(company, plan);
  const urgency = deriveUrgency(opportunityScore, staleVacancies > 0, vacancyCount);

  const partial = {
    opportunityScore,
    agencyNeedLikelihood,
    why,
    rolesSought,
    urgency,
    breakdown: {
      growth,
      multipleVacancies,
      noInternalRecruiter,
      staleVacancies,
      scalability,
    },
  };

  const intelligence = assessRecruitmentPotentialFromCompany(company);

  return {
    ...partial,
    recruitmentPotential: intelligence.recruitmentPotential,
    recruitmentPotentialMotivation: intelligence.motivation,
    bestApproach: deriveBestApproach(partial.breakdown, company),
  };
}

export function isOutreachEligible(
  opportunityScore: number,
  plan: AiRecruiterSearchPlan,
): boolean {
  return opportunityScore >= plan.minimum_opportunity_score;
}
