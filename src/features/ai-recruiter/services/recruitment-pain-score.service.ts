import type { CompanyVacancyItem } from "@/features/company-intelligence/domain/company-page.types";
import type { Company } from "@/features/companies/domain";
import type {
  PainScoreDimension,
  ProspectRecruitmentPainScore,
} from "@/features/ai-recruiter/domain/prospect-dossier.types";
import type { AiRecruiterScoreBreakdown } from "@/features/ai-recruiter/domain/types";

const SALES_ROLE_PATTERN =
  /sales|account manager|business development|commercial|verkoop|accountmanager|customer success/i;
const MANAGEMENT_ROLE_PATTERN =
  /manager|directeur|head of|lead|teamlead|team lead|ceo|cfo|cto|vp|hoofd/i;
const STALE_DAYS_THRESHOLD = 45;

function scaleTo100(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function avgVacancyAgeDays(vacancies: CompanyVacancyItem[]): number | null {
  const open = vacancies.filter((v) => v.status === "open" || v.status === "active");
  if (open.length === 0) return null;
  const totalDays = open.reduce((sum, v) => sum + daysSince(v.createdAt), 0);
  return Math.round(totalDays / open.length);
}

function countMatchingVacancies(vacancies: CompanyVacancyItem[], pattern: RegExp): number {
  return vacancies.filter((v) => pattern.test(v.title)).length;
}

export function computeRecruitmentPainScore(input: {
  company: Company | null;
  vacancies: CompanyVacancyItem[];
  scoreBreakdown: AiRecruiterScoreBreakdown;
  hiringScore: number | null;
}): ProspectRecruitmentPainScore {
  const { company, vacancies, scoreBreakdown, hiringScore } = input;
  const sales = scoreBreakdown.salesBreakdown;
  const openVacancies = vacancies.filter((v) => v.status === "open" || v.status === "active");
  const vacancyCount = openVacancies.length || company?.vacancyCount || 0;

  const growthRaw = sales?.growth ?? 0;
  const growthScore = scaleTo100(growthRaw, 20);

  const pressureRaw = (sales?.openVacancies ?? 0) + (sales?.recruitmentActivity ?? 0);
  const hiringPressureScore = scaleTo100(pressureRaw, 45);

  let vacancyCountScore = 0;
  let vacancyDetail = "Geen open vacatures gevonden.";
  if (vacancyCount >= 5) {
    vacancyCountScore = 100;
    vacancyDetail = `${vacancyCount} open vacatures — hoge wervingsdruk.`;
  } else if (vacancyCount >= 3) {
    vacancyCountScore = 80;
    vacancyDetail = `${vacancyCount} open vacatures — meerdere parallelle rollen.`;
  } else if (vacancyCount === 2) {
    vacancyCountScore = 60;
    vacancyDetail = "2 open vacatures.";
  } else if (vacancyCount === 1) {
    vacancyCountScore = 35;
    vacancyDetail = "1 open vacature.";
  }

  const avgAge = avgVacancyAgeDays(vacancies);
  let vacancyAgeScore = 0;
  let vacancyAgeDetail = "Geen vacatureleeftijd beschikbaar.";
  if (avgAge != null) {
    if (avgAge >= STALE_DAYS_THRESHOLD) {
      vacancyAgeScore = 100;
      vacancyAgeDetail = `Gemiddeld ${avgAge} dagen open — vacatures staan lang open.`;
    } else if (avgAge >= 30) {
      vacancyAgeScore = 75;
      vacancyAgeDetail = `Gemiddeld ${avgAge} dagen open — matige doorlooptijd.`;
    } else if (avgAge >= 14) {
      vacancyAgeScore = 45;
      vacancyAgeDetail = `Gemiddeld ${avgAge} dagen open.`;
    } else {
      vacancyAgeScore = 20;
      vacancyAgeDetail = `Recente vacatures (gem. ${avgAge} dagen).`;
    }
  } else if (company?.hiringSignals.some((s) => /(\d{2,}|\b30\+?\b)\s*dagen|lang open|stale/i.test(s.description))) {
    vacancyAgeScore = 85;
    vacancyAgeDetail = "Signalen wijzen op lang openstaande vacatures.";
  }

  const last30 = vacancies.filter((v) => daysSince(v.createdAt) <= 30).length;
  const prev30 = vacancies.filter((v) => {
    const d = daysSince(v.createdAt);
    return d > 30 && d <= 60;
  }).length;
  let velocityScore = 0;
  let velocityDetail = "Onvoldoende data voor hiring velocity.";
  if (last30 >= 3) {
    velocityScore = 100;
    velocityDetail = `${last30} nieuwe vacatures in 30 dagen — hoge velocity.`;
  } else if (last30 === 2) {
    velocityScore = 70;
    velocityDetail = "2 nieuwe vacatures in 30 dagen.";
  } else if (last30 === 1) {
    velocityScore = 45;
    velocityDetail = "1 nieuwe vacature in 30 dagen.";
  } else if (prev30 > 0) {
    velocityScore = 25;
    velocityDetail = "Geen nieuwe vacatures in 30 dagen.";
  }

  const salesHiringCount = countMatchingVacancies(openVacancies, SALES_ROLE_PATTERN);
  let salesHiringScore = 0;
  let salesHiringDetail = "Geen sales-vacatures gevonden.";
  if (salesHiringCount >= 2) {
    salesHiringScore = 100;
    salesHiringDetail = `${salesHiringCount} sales/commercial vacatures.`;
  } else if (salesHiringCount === 1) {
    salesHiringScore = 55;
    salesHiringDetail = "1 sales/commercial vacature.";
  }

  const mgmtHiringCount = countMatchingVacancies(openVacancies, MANAGEMENT_ROLE_PATTERN);
  let mgmtScore = 0;
  let mgmtDetail = "Geen management-vacatures gevonden.";
  if (mgmtHiringCount >= 2) {
    mgmtScore = 90;
    mgmtDetail = `${mgmtHiringCount} management/leidinggevende vacatures.`;
  } else if (mgmtHiringCount === 1) {
    mgmtScore = 50;
    mgmtDetail = "1 management/leidinggevende vacature.";
  }

  const dimensions: PainScoreDimension[] = [
    { key: "growth", label: "Groei", score: growthScore, maxScore: 100, detail: sales?.growth ? `Sales score groei: ${growthRaw}/20.` : "Geen groeisignalen." },
    { key: "hiring_pressure", label: "Hiring pressure", score: hiringPressureScore, maxScore: 100, detail: `Gecombineerde vacature- en recruitmentactiviteit (${pressureRaw}/45).` },
    { key: "vacancy_count", label: "Aantal vacatures", score: vacancyCountScore, maxScore: 100, detail: vacancyDetail },
    { key: "vacancy_age", label: "Leeftijd vacatures", score: vacancyAgeScore, maxScore: 100, detail: vacancyAgeDetail },
    { key: "hiring_velocity", label: "Hiring velocity", score: velocityScore, maxScore: 100, detail: velocityDetail },
    { key: "sales_hiring", label: "Sales hiring", score: salesHiringScore, maxScore: 100, detail: salesHiringDetail },
    { key: "management_hiring", label: "Management hiring", score: mgmtScore, maxScore: 100, detail: mgmtDetail },
  ];

  const avgDimension = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
  const hiringBoost = hiringScore != null ? Math.round(hiringScore * 0.15) : 0;
  const total = Math.min(100, Math.round(avgDimension * 0.85 + hiringBoost));

  return { total, dimensions };
}
