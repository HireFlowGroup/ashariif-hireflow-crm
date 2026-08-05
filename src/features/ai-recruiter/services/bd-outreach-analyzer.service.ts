import type { Company } from "@/features/companies/domain";
import type { BdOutreachAnalysis } from "@/features/ai-recruiter/domain/types";
import { bdOutreachAnalysisSchema } from "@/features/ai-recruiter/domain/types";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";

function isGrowthSignal(description: string): boolean {
  return /groei|uitbreid|scale-up|funding|investering|nieuw kantoor|headcount/i.test(description);
}

function inferGrowthStage(company: Company, hiring: HiringIntelligenceProfile): string | null {
  const max = company.employeeCountMax ?? company.employeeCount;
  const hasGrowth = hiring.signals.some(
    (s) => isGrowthSignal(s.description ?? "") || isGrowthSignal(s.type),
  );

  if (hasGrowth && max != null && max <= 100) return "scale-up in groei";
  if (hasGrowth && max != null && max <= 500) return "groeiende organisatie";
  if (hasGrowth) return "organisatie in uitbreiding";
  if (max != null && max <= 50) return "compact team";
  if (max != null && max <= 250) return "middelgroot bedrijf";
  return company.sector ? `speler in ${company.sector}` : null;
}

function hasInternalRecruiterSignal(hiring: HiringIntelligenceProfile): boolean {
  return hiring.signals.some((s) =>
    /interne recruiter|recruitment team|talent acquisition team|inhouse recruiter|ta team/i.test(
      s.description ?? "",
    ),
  );
}

export function analyzeBdOutreachContext(
  company: Company,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
): BdOutreachAnalysis {
  const factsUsed: string[] = [company.name];
  const growthStage = inferGrowthStage(company, hiring);

  if (company.sector) factsUsed.push(`branche: ${company.sector}`);
  if (growthStage) factsUsed.push(`fase: ${growthStage}`);
  if (hiring.vacancyCount > 0) factsUsed.push(`${hiring.vacancyCount} vacature(s)`);
  if (hiring.vacancyTitles.length) factsUsed.push(hiring.vacancyTitles.slice(0, 2).join(", "));
  for (const signal of hiring.signals.slice(0, 2)) {
    factsUsed.push(signal.description ?? signal.title);
  }

  let whyAgency: string;
  if (hiring.vacancyCount >= 2 && !hasInternalRecruiterSignal(hiring)) {
    whyAgency = `${company.name} heeft meerdere vacatures open staan zonder zicht op een uitgebreid intern recruitmentteam — externe capaciteit is dan vaak logisch.`;
  } else if (hiring.vacancyCount >= 2) {
    whyAgency = `Met ${hiring.vacancyCount} parallelle vacatures schuift werving snel op de agenda — een bureau kan piekdruk opvangen.`;
  } else if (opportunity.urgency === "high") {
    whyAgency = `Vacatures die blijven open staan kosten tijd en focus — daar schakelen bedrijven als ${company.name} soms een partner voor in.`;
  } else if (!hasInternalRecruiterSignal(hiring) && hiring.vacancyCount > 0) {
    whyAgency = `${company.name} zoekt personeel terwijl HR/recruitment waarschijnlijk niet volledig dedicated is — externe ondersteuning is gebruikelijk.`;
  } else if (growthStage?.includes("scale-up") || growthStage?.includes("groei")) {
    whyAgency = `In een groeifase loopt hiring vaak voor op interne capaciteit — ${company.name} past in dat patroon.`;
  } else {
    whyAgency = `Bij actieve hiring in ${company.sector ?? "de markt"} kiezen bedrijven soms voor flexibele recruitment-ondersteuning naast interne inspanning.`;
  }

  const painParts: string[] = [];
  if (hiring.vacancyCount >= 2) painParts.push("meerdere rollen tegelijk invullen");
  if (opportunity.urgency === "high") painParts.push("vacatures die te lang open blijven");
  if (!hasInternalRecruiterSignal(hiring)) painParts.push("beperkte interne recruitmentcapaciteit");
  if (growthStage?.includes("groei") || growthStage?.includes("scale-up")) {
    painParts.push("werving die moet meegroeien met het bedrijf");
  }
  if (company.sector) painParts.push(`krapte op de arbeidsmarkt in ${company.sector}`);

  const likelyPain =
    painParts.length > 0
      ? `Waarschijnlijke pijn: ${painParts.slice(0, 3).join(", ")}.`
      : "Waarschijnlijke pijn: hiring kost meer tijd dan gepland, zonder extra capaciteit op de achtergrond.";

  const hireFlowParts: string[] = [
    "HireFlow Group levert flexibele recruitment-ondersteuning — meedenken en opschalen wanneer het druk wordt, zonder vaste FTE",
  ];
  if (company.sector) {
    hireFlowParts.push(`ervaring met hiring in ${company.sector}`);
  }
  if (hiring.vacancyCount > 0) {
    hireFlowParts.push("gericht op snelle invulling van open rollen");
  }
  const whyHireFlow = `${hireFlowParts.join(", ")}.`;

  return bdOutreachAnalysisSchema.parse({
    whyAgency,
    likelyPain,
    whyHireFlow,
    growthStage,
    factsUsed,
  });
}

/** Deterministic index for opener/CTA variation per company. */
export function pickVariantIndex(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}
