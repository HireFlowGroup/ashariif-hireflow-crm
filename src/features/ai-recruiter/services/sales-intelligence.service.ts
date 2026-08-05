import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";

export type SalesLeadTier = "HOT LEAD" | "WARM LEAD" | "FOLLOW" | "IGNORE";

export type SalesIntelligenceBreakdown = {
  openVacancies: number;
  growth: number;
  recruitmentActivity: number;
  companySize: number;
  externalRecruiterChance: number;
};

export type SalesIntelligenceAssessment = {
  salesScore: number;
  tier: SalesLeadTier;
  why: string[];
  breakdown: SalesIntelligenceBreakdown;
};

const GROWTH_TYPES = ["growth", "expansion", "funding", "new_office", "scale"];
const INTERNAL_RECRUITER = ["new_recruiter", "internal_recruiter", "ta_team", "recruitment_team"];
const RECRUITMENT_ACTIVITY_TYPES = [
  "vacancy",
  "linkedin_hiring",
  "indeed_vacancy",
  "careers_page",
  "new_recruiter",
  "new_hr_manager",
];
const PARTNER_PATTERN =
  /recruitment\s*(partner|bureau)|uitzendbureau|randstad|adecco|manpower|tempo-team|youngcapital|michael page|hays/i;

function hasGrowthSignal(company: Company): boolean {
  return company.hiringSignals.some(
    (s) =>
      GROWTH_TYPES.some((t) => s.type.toLowerCase().includes(t))
      || /groei|uitbreid|scale-up|funding|investering|nieuw kantoor/i.test(s.description),
  );
}

function hasInternalRecruiter(company: Company): boolean {
  return company.hiringSignals.some(
    (s) =>
      INTERNAL_RECRUITER.some((t) => s.type.toLowerCase().includes(t))
      || /interne recruiter|inhouse recruiter|talent acquisition team|recruitment team/i.test(s.description),
  );
}

function hasRecruitmentPartner(company: Company): boolean {
  return company.hiringSignals.some((s) => PARTNER_PATTERN.test(s.description));
}

function hasStaleVacancies(company: Company): boolean {
  return company.hiringSignals.some((s) =>
    /(\d{2,}|\b30\+?\b)\s*dagen|lang open|stale|openstaand sinds/i.test(s.description),
  );
}

export function scoreOpenVacancies(vacancyCount: number): { score: number; why: string } {
  if (vacancyCount >= 4) {
    return { score: 25, why: `${vacancyCount} open vacatures — maximale hiringdruk (25/25).` };
  }
  if (vacancyCount === 3) {
    return { score: 22, why: "3 open vacatures — hoge parallelle hiring (22/25)." };
  }
  if (vacancyCount === 2) {
    return { score: 18, why: "2 open vacatures — concrete hiringbehoefte (18/25)." };
  }
  if (vacancyCount === 1) {
    return { score: 10, why: "1 open vacature — beperkte maar zichtbare behoefte (10/25)." };
  }
  return { score: 0, why: "Geen open vacatures zichtbaar (0/25)." };
}

export function scoreGrowth(company: Company): { score: number; why: string } {
  const strong = company.hiringSignals.filter(
    (s) =>
      GROWTH_TYPES.some((t) => s.type.toLowerCase().includes(t))
      || /funding|investering|series [abc]|nieuw kantoor|uitbreid/i.test(s.description),
  );

  if (strong.length >= 2) {
    return { score: 20, why: "Meerdere groei-/investeringssignalen (20/20)." };
  }
  if (hasGrowthSignal(company)) {
    return { score: 16, why: "Groei- of uitbreidingssignaal gedetecteerd (16/20)." };
  }

  const size = company.employeeCountMax ?? company.employeeCount ?? 0;
  if (size >= 50) {
    return { score: 8, why: "Schaalbare omvang suggereert groeipotentieel (8/20)." };
  }

  return { score: 0, why: "Geen groeisignalen (0/20)." };
}

export function scoreRecruitmentActivity(
  company: Company,
  hiring: HiringIntelligenceProfile,
): { score: number; why: string } {
  let score = 0;
  const parts: string[] = [];

  const activitySignals = company.hiringSignals.filter(
    (s) =>
      RECRUITMENT_ACTIVITY_TYPES.some((t) => s.type.toLowerCase().includes(t))
      || /vacature|hiring|recruitment|werken bij/i.test(s.description),
  );

  if (activitySignals.length >= 4) {
    score += 14;
    parts.push("4+ recruitment-signalen");
  } else if (activitySignals.length >= 2) {
    score += 10;
    parts.push("meerdere recruitment-signalen");
  } else if (activitySignals.length === 1) {
    score += 6;
    parts.push("1 recruitment-signaal");
  }

  if (company.hiringSignals.some((s) => s.type.toLowerCase().includes("linkedin"))) {
    score += 4;
    parts.push("LinkedIn hiring");
  }

  if (hiring.careersUrl) {
    score += 3;
    parts.push("werken-bij pagina");
  }

  if (company.hiringSignals.some((s) => hasStaleVacancies({ ...company, hiringSignals: [s] }))) {
    score += 3;
    parts.push("lang openstaande vacatures");
  }

  score = Math.min(20, score);

  if (score === 0) {
    return { score: 0, why: "Geen recruitment-activiteit zichtbaar (0/20)." };
  }

  return { score, why: `Recruitment-activiteit: ${parts.join(", ")} (${score}/20).` };
}

export function scoreCompanySize(company: Company): { score: number; why: string } {
  const size =
    company.employeeCount
    ?? company.employeeCountMax
    ?? company.employeeCountMin
    ?? null;

  if (size === null) {
    return { score: 4, why: "Bedrijfsomvang onbekend (4/10)." };
  }
  if (size >= 20 && size <= 500) {
    return { score: 10, why: `${size} FTE — ideale schaal voor externe recruitment (10/10).` };
  }
  if (size >= 10 && size <= 750) {
    return { score: 6, why: `${size} FTE — geschikte omvang (6/10).` };
  }
  return { score: 2, why: `${size} FTE — minder typisch voor bureau-opdracht (2/10).` };
}

export function scoreExternalRecruiterChance(company: Company): { score: number; why: string } {
  const vacancies = company.vacancyCount ?? 0;
  let score = 0;
  const parts: string[] = [];

  if (!hasInternalRecruiter(company)) {
    if (vacancies >= 3) {
      score += 18;
      parts.push("geen interne recruiter + 3+ vacatures");
    } else if (vacancies >= 1) {
      score += 14;
      parts.push("geen interne recruiter + open vacatures");
    } else {
      score += 6;
      parts.push("geen intern TA-team zichtbaar");
    }
  } else {
    score += 3;
    parts.push("intern recruitment/signaal — lagere kans");
  }

  if (hasStaleVacancies(company)) {
    score += 7;
    parts.push("vacatures lijken lang open — behoefte aan versnelling");
  }

  if (hasRecruitmentPartner(company)) {
    score = Math.max(0, score - 10);
    parts.push("bestaande recruitmentpartner — lagere kans");
  }

  score = Math.min(25, score);

  if (score >= 20) {
    return { score, why: `Hoge kans op externe recruiter: ${parts.join("; ")} (${score}/25).` };
  }
  if (score >= 10) {
    return { score, why: `Gemiddelde kans op externe recruiter: ${parts.join("; ")} (${score}/25).` };
  }
  return { score, why: `Beperkte kans op externe recruiter: ${parts.join("; ")} (${score}/25).` };
}

export function deriveSalesLeadTier(score: number): SalesLeadTier {
  if (score >= 80) return "HOT LEAD";
  if (score >= 70) return "WARM LEAD";
  if (score >= 50) return "FOLLOW";
  return "IGNORE";
}

export function isSalesOutreachEligible(tier: SalesLeadTier): boolean {
  return tier !== "IGNORE";
}

export function salesToScoreBreakdownFields(sales: SalesIntelligenceAssessment) {
  return {
    salesScore: sales.salesScore,
    salesTier: sales.tier,
    salesWhy: sales.why,
    salesBreakdown: sales.breakdown,
  };
}

export function computeSalesIntelligence(
  company: Company,
  hiring: HiringIntelligenceProfile,
  _plan: AiRecruiterSearchPlan,
): SalesIntelligenceAssessment {
  const openVacancies = scoreOpenVacancies(hiring.vacancyCount);
  const growth = scoreGrowth(company);
  const recruitmentActivity = scoreRecruitmentActivity(company, hiring);
  const companySize = scoreCompanySize(company);
  const externalRecruiterChance = scoreExternalRecruiterChance(company);

  const breakdown: SalesIntelligenceBreakdown = {
    openVacancies: openVacancies.score,
    growth: growth.score,
    recruitmentActivity: recruitmentActivity.score,
    companySize: companySize.score,
    externalRecruiterChance: externalRecruiterChance.score,
  };

  const salesScore = Math.min(
    100,
    breakdown.openVacancies
      + breakdown.growth
      + breakdown.recruitmentActivity
      + breakdown.companySize
      + breakdown.externalRecruiterChance,
  );

  const tier = deriveSalesLeadTier(salesScore);

  const why = [
    openVacancies.why,
    growth.why,
    recruitmentActivity.why,
    companySize.why,
    externalRecruiterChance.why,
    `Sales Intelligence: ${salesScore}/100 → ${tier}.`,
  ];

  return { salesScore, tier, why, breakdown };
}
