import type { Company } from "@/features/companies/domain";
import type { CompanyAnalysisContext } from "@/features/company-ai-analysis/domain/analysis.types";

export type RecruitmentPotential = "LOW" | "MEDIUM" | "HIGH";

export type IntelligenceDimension =
  | "vacancies"
  | "growth"
  | "news"
  | "linkedinHiring"
  | "investments"
  | "expansion"
  | "newLocations"
  | "reorganizations"
  | "employerBranding"
  | "ats"
  | "recruitmentPartners";

export type IntelligenceFinding = {
  dimension: IntelligenceDimension;
  detected: boolean;
  summary: string;
};

export type RecruitmentPotentialAssessment = {
  recruitmentPotential: RecruitmentPotential;
  motivation: string;
  score: number;
  findings: IntelligenceFinding[];
};

type SignalLike = {
  type: string;
  description: string;
  title?: string | null;
};

const PARTNER_KEYWORDS =
  /recruitment\s*(partner|bureau)|uitzendbureau|detacherings|randstad|adecco|manpower|tempo-team|youngcapital|michael page|hays|brunel|yacht|experis|unique|start people|recruitment\s*agency/i;

const REORG_KEYWORDS =
  /reorganisat|herstructur|nieuwe?\s*ceo|nieuwe?\s*directeur|leadership|management\s*wissel|fusie|overname/i;

function textOf(signal: SignalLike): string {
  return `${signal.type} ${signal.title ?? ""} ${signal.description}`.toLowerCase();
}

function hasType(signals: SignalLike[], types: string[]): boolean {
  return signals.some((s) => types.some((t) => s.type.toLowerCase().includes(t)));
}

function hasKeyword(signals: SignalLike[], pattern: RegExp): boolean {
  return signals.some((s) => pattern.test(textOf(s)));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function detectFindings(input: {
  vacancyCount: number;
  careersUrl: string | null;
  atsDetected: boolean;
  atsProviders: string[];
  signals: SignalLike[];
}): IntelligenceFinding[] {
  const { vacancyCount, careersUrl, atsDetected, atsProviders, signals } = input;

  const vacancySummary =
    vacancyCount >= 3
      ? `${vacancyCount} openstaande vacatures — parallelle hiring`
      : vacancyCount === 2
        ? "2 openstaande vacatures"
        : vacancyCount === 1
          ? "1 openstaande vacature"
          : "Geen vacatures zichtbaar";

  const growthDetected =
    hasType(signals, ["growth", "expansion", "scale", "funding"])
    || hasKeyword(signals, /groei|uitbreid|scale-up|headcount/i);

  const newsDetected = hasType(signals, ["news"]) || hasKeyword(signals, /nieuws|persbericht|aankondiging/i);

  const linkedInDetected =
    hasType(signals, ["linkedin_hiring", "linkedin"])
    || hasKeyword(signals, /linkedin.*(vacature|hiring|We're hiring|wij zoeken)/i);

  const investmentDetected =
    hasType(signals, ["funding"])
    || hasKeyword(signals, /investering|investeer|series [abc]|financiering|kapitaalronde/i);

  const expansionDetected =
    growthDetected
    || hasKeyword(signals, /uitbreid|expansie|nieuw segment|internationaal/i);

  const newLocationDetected =
    hasType(signals, ["new_location", "google_maps_change"])
    || hasKeyword(signals, /nieuwe vestiging|nieuw kantoor|opening.*locatie/i);

  const reorgDetected =
    hasType(signals, ["new_hr_manager", "new_recruiter"])
    || hasKeyword(signals, REORG_KEYWORDS);

  const employerBrandingDetected =
    hasType(signals, ["careers_page", "website_change"])
    || Boolean(careersUrl)
    || hasKeyword(signals, /employer brand|werken bij|employer branding|EVP/i);

  const atsFound =
    atsDetected
    || atsProviders.length > 0
    || hasType(signals, ["ats_detected"])
    || hasKeyword(signals, /greenhouse|lever|workday|recruitee|teamtailor|smartrecruiters|bamboohr/i);

  const partnerDetected = hasKeyword(signals, PARTNER_KEYWORDS);

  return [
    { dimension: "vacancies", detected: vacancyCount > 0, summary: vacancySummary },
    {
      dimension: "growth",
      detected: growthDetected,
      summary: growthDetected ? "Groei- of schaalsignalen gedetecteerd" : "Geen groeisignalen",
    },
    {
      dimension: "news",
      detected: newsDetected,
      summary: newsDetected ? "Recent nieuws of persbericht" : "Geen nieuws",
    },
    {
      dimension: "linkedinHiring",
      detected: linkedInDetected,
      summary: linkedInDetected ? "LinkedIn hiring-activiteit" : "Geen LinkedIn hiring",
    },
    {
      dimension: "investments",
      detected: investmentDetected,
      summary: investmentDetected ? "Investering of funding" : "Geen investeringssignalen",
    },
    {
      dimension: "expansion",
      detected: expansionDetected,
      summary: expansionDetected ? "Uitbreiding of marktgroei" : "Geen uitbreiding",
    },
    {
      dimension: "newLocations",
      detected: newLocationDetected,
      summary: newLocationDetected ? "Nieuwe vestiging of locatie" : "Geen nieuwe vestigingen",
    },
    {
      dimension: "reorganizations",
      detected: reorgDetected,
      summary: reorgDetected ? "Reorganisatie of nieuw HR/recruitment-leiderschap" : "Geen reorganisatie",
    },
    {
      dimension: "employerBranding",
      detected: employerBrandingDetected,
      summary: employerBrandingDetected ? "Employer branding / werken-bij investering" : "Beperkt employer branding",
    },
    {
      dimension: "ats",
      detected: atsFound,
      summary: atsFound
        ? `ATS: ${atsProviders.length > 0 ? atsProviders.join(", ") : "gedetecteerd"}`
        : "Geen ATS zichtbaar",
    },
    {
      dimension: "recruitmentPartners",
      detected: partnerDetected,
      summary: partnerDetected ? "Externe recruitmentpartner zichtbaar" : "Geen recruitmentpartner zichtbaar",
    },
  ];
}

function scoreAssessment(input: {
  vacancyCount: number;
  findings: IntelligenceFinding[];
  hasInternalRecruiter: boolean;
  employeeCount: number | null;
}): number {
  let score = 0;
  const { vacancyCount, findings, hasInternalRecruiter, employeeCount } = input;

  if (vacancyCount >= 3) score += 25;
  else if (vacancyCount === 2) score += 18;
  else if (vacancyCount === 1) score += 10;

  const detected = (dim: IntelligenceDimension) =>
    findings.find((f) => f.dimension === dim)?.detected ?? false;

  if (detected("growth")) score += 12;
  if (detected("investments")) score += 12;
  if (detected("expansion")) score += 10;
  if (detected("newLocations")) score += 10;
  if (detected("linkedinHiring")) score += 10;
  if (detected("reorganizations")) score += 8;
  if (detected("news")) score += 6;
  if (detected("employerBranding")) score += 6;
  if (detected("ats")) score += 5;

  if (hasInternalRecruiter) score -= 18;
  if (detected("recruitmentPartners")) score -= 12;
  if (!hasInternalRecruiter && vacancyCount >= 1) score += 12;

  if (employeeCount !== null && employeeCount >= 20 && employeeCount <= 500) score += 8;

  return Math.max(0, Math.min(100, score));
}

function derivePotential(score: number, vacancyCount: number, hasInternalRecruiter: boolean): RecruitmentPotential {
  if (score >= 55 || (vacancyCount >= 3 && !hasInternalRecruiter)) return "HIGH";
  if (score >= 28 || vacancyCount >= 1) return "MEDIUM";
  return "LOW";
}

function hasInternalRecruiter(signals: SignalLike[]): boolean {
  return (
    hasType(signals, ["new_recruiter", "internal_recruiter", "ta_team"])
    || hasKeyword(signals, /interne recruiter|inhouse recruiter|talent acquisition team|recruitment team/i)
  );
}

function buildMotivation(
  companyName: string,
  potential: RecruitmentPotential,
  findings: IntelligenceFinding[],
  vacancyCount: number,
  hasInternalRecruiterTeam: boolean,
): string {
  const positive = findings.filter((f) => f.detected && f.dimension !== "recruitmentPartners");
  const partner = findings.find((f) => f.dimension === "recruitmentPartners");

  const parts: string[] = [];

  if (potential === "HIGH") {
    parts.push(`${companyName} heeft hoog recruitment potential.`);
  } else if (potential === "MEDIUM") {
    parts.push(`${companyName} toont gemiddeld recruitment potential.`);
  } else {
    parts.push(`${companyName} heeft beperkt recruitment potential op dit moment.`);
  }

  if (vacancyCount > 0) {
    parts.push(positive.find((f) => f.dimension === "vacancies")?.summary ?? `${vacancyCount} vacature(s).`);
  }

  const highlights = positive
    .filter((f) => f.dimension !== "vacancies")
    .slice(0, 4)
    .map((f) => f.summary.toLowerCase());

  if (highlights.length > 0) {
    parts.push(`Signalen: ${highlights.join(", ")}.`);
  }

  if (hasInternalRecruiterTeam) {
    parts.push("Intern recruitment/TA lijkt aanwezig — lagere kans op bureau-opdracht.");
  } else if (vacancyCount >= 1) {
    parts.push("Geen interne recruiter zichtbaar — externe ondersteuning waarschijnlijk.");
  }

  if (partner?.detected) {
    parts.push("Bestaande recruitmentpartner zichtbaar — benadering vereist differentiatie.");
  } else if (potential !== "LOW") {
    parts.push("Geen zichtbare recruitmentpartner — kans op nieuwe samenwerking.");
  }

  if (potential === "HIGH") {
    parts.push("Aanbeveling: commerciële benadering met focus op schaalbare hiring-ondersteuning.");
  } else if (potential === "MEDIUM") {
    parts.push("Aanbeveling: relatie opbouwen; timing volgen op nieuwe vacatures of groei.");
  } else {
    parts.push("Aanbeveling: monitoren; geen directe outreach tenzij nieuwe signalen.");
  }

  return truncateWords(parts.join(" "), 120);
}

export function assessRecruitmentPotentialFromCompany(company: Company): RecruitmentPotentialAssessment {
  const signals: SignalLike[] = company.hiringSignals.map((s) => ({
    type: s.type,
    description: s.description,
  }));

  const findings = detectFindings({
    vacancyCount: company.vacancyCount ?? 0,
    careersUrl: company.careersUrl,
    atsDetected: false,
    atsProviders: [],
    signals,
  });

  const internalRecruiter = hasInternalRecruiter(signals);
  const score = scoreAssessment({
    vacancyCount: company.vacancyCount ?? 0,
    findings,
    hasInternalRecruiter: internalRecruiter,
    employeeCount: company.employeeCount ?? company.employeeCountMax ?? company.employeeCountMin,
  });

  const recruitmentPotential = derivePotential(score, company.vacancyCount ?? 0, internalRecruiter);

  return {
    recruitmentPotential,
    motivation: buildMotivation(
      company.name,
      recruitmentPotential,
      findings,
      company.vacancyCount ?? 0,
      internalRecruiter,
    ),
    score,
    findings,
  };
}

export function assessRecruitmentPotentialFromContext(
  context: CompanyAnalysisContext,
): RecruitmentPotentialAssessment {
  const signals: SignalLike[] = context.signals.map((s) => ({
    type: s.type,
    description: s.description ?? "",
    title: s.title,
  }));

  const findings = detectFindings({
    vacancyCount: context.vacancies.length,
    careersUrl: context.careersUrl,
    atsDetected: context.atsDetected,
    atsProviders: context.atsProviders,
    signals,
  });

  const internalRecruiter = hasInternalRecruiter(signals);
  const score = scoreAssessment({
    vacancyCount: context.vacancies.length,
    findings,
    hasInternalRecruiter: internalRecruiter,
    employeeCount: null,
  });

  const recruitmentPotential = derivePotential(score, context.vacancies.length, internalRecruiter);

  return {
    recruitmentPotential,
    motivation: buildMotivation(
      context.companyName,
      recruitmentPotential,
      findings,
      context.vacancies.length,
      internalRecruiter,
    ),
    score,
    findings,
  };
}

export function recruitmentPotentialLabel(potential: RecruitmentPotential): string {
  switch (potential) {
    case "HIGH":
      return "Hoog";
    case "MEDIUM":
      return "Gemiddeld";
    case "LOW":
      return "Laag";
  }
}
