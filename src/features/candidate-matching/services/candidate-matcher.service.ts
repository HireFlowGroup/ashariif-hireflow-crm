import type { Vacancy } from "@/features/vacancies/domain";
import type {
  CandidateMatchBreakdown,
  CandidateMatchInput,
  CandidateMatchResult,
} from "@/features/candidate-matching/domain/match.types";
import { candidateMatchResultSchema } from "@/features/candidate-matching/domain/match.types";

const STOP_WORDS = new Set([
  "de",
  "het",
  "een",
  "en",
  "of",
  "voor",
  "met",
  "van",
  "in",
  "op",
  "te",
  "als",
  "bij",
  "naar",
  "the",
  "and",
  "for",
  "with",
  "years",
  "jaar",
  "ervaring",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ+#.\s-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function uniqueTokens(texts: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const text of texts) {
    for (const token of tokenize(text)) {
      tokens.add(token);
    }
  }
  return tokens;
}

function overlapRatio(required: Set<string>, provided: Set<string>): number {
  if (required.size === 0) return provided.size > 0 ? 0.6 : 0.4;
  let hits = 0;
  for (const token of required) {
    if (provided.has(token)) hits += 1;
  }
  return hits / required.size;
}

function normalizeLocation(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function locationsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeLocation(a);
  const right = normalizeLocation(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

function formatSalaryRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min != null && max != null) return `€${min.toLocaleString("nl-NL")} – €${max.toLocaleString("nl-NL")} bruto p/j`;
  if (min != null) return `vanaf €${min.toLocaleString("nl-NL")} bruto p/j`;
  if (max != null) return `tot €${max.toLocaleString("nl-NL")} bruto p/j`;
  return "Niet opgegeven";
}

function scoreRoleFit(vacancy: Vacancy, candidate: CandidateMatchInput): number {
  const vacancyTokens = uniqueTokens([vacancy.title, vacancy.description ?? ""]);
  const candidateTokens = uniqueTokens([
    candidate.candidateCurrentRole ?? "",
    candidate.summary ?? "",
  ]);

  const ratio = overlapRatio(vacancyTokens, candidateTokens);
  return Math.round(Math.min(25, ratio * 25));
}

function scoreSkillsFit(vacancy: Vacancy, candidate: CandidateMatchInput): {
  score: number;
  matched: string[];
  missing: string[];
} {
  const requirementText = [vacancy.requirements, vacancy.description, vacancy.title]
    .filter(Boolean)
    .join(" ");
  const requirementTokens = uniqueTokens([requirementText]);
  const candidateSkills = (candidate.skills ?? []).map((s) => s.toLowerCase());
  const candidateTokens = uniqueTokens([
    ...candidateSkills,
    candidate.summary ?? "",
    candidate.candidateCurrentRole ?? "",
  ]);

  const matched: string[] = [];
  for (const skill of candidate.skills ?? []) {
    const lower = skill.toLowerCase();
    if (
      requirementText.toLowerCase().includes(lower)
      || [...requirementTokens].some((t) => lower.includes(t) || t.includes(lower))
    ) {
      matched.push(skill);
    }
  }

  const missing: string[] = [];
  for (const token of requirementTokens) {
    if (token.length < 4) continue;
    const found =
      candidateTokens.has(token)
      || candidateSkills.some((s) => s.includes(token) || token.includes(s));
    if (!found && missing.length < 5) missing.push(token);
  }

  const ratio = overlapRatio(requirementTokens, candidateTokens);
  const skillBoost = Math.min(14, matched.length * 3);
  const explicitMatchBoost = matched.length >= 2 ? 6 : 0;
  return {
    score: Math.round(Math.min(30, ratio * 18 + skillBoost + explicitMatchBoost)),
    matched,
    missing,
  };
}

function scoreLocationFit(vacancy: Vacancy, candidate: CandidateMatchInput): number {
  if (!vacancy.location || !candidate.location) return 6;
  if (locationsMatch(vacancy.location, candidate.location)) return 15;
  if (/remote|hybride|thuis/i.test(vacancy.location) || /remote|hybride|thuis/i.test(candidate.location ?? "")) {
    return 12;
  }
  return 2;
}

function scoreExperienceFit(vacancy: Vacancy, candidate: CandidateMatchInput): number {
  const text = [vacancy.requirements, vacancy.description, vacancy.title].join(" ").toLowerCase();
  const yearsRequired = text.match(/(\d+)\+?\s*(?:jaar|years)/)?.[1];
  const required = yearsRequired ? Number(yearsRequired) : null;
  const actual = candidate.experienceYears ?? null;

  if (required === null || actual === null) return 8;
  if (actual >= required) return 15;
  if (actual >= required - 1) return 11;
  if (actual >= required - 2) return 7;
  return 3;
}

function scoreSalaryFit(vacancy: Vacancy, candidate: CandidateMatchInput): {
  score: number;
  note: string | null;
} {
  const candMin = candidate.salaryExpectationMin ?? null;
  const candMax = candidate.salaryExpectationMax ?? null;
  const vacMin = vacancy.salaryMin;
  const vacMax = vacancy.salaryMax;

  if ((candMin === null && candMax === null) || (vacMin === null && vacMax === null)) {
    return { score: 7, note: "Salarisrange onvolledig — handmatig verifiëren." };
  }

  const expectation = candMin ?? candMax!;
  const budgetMax = vacMax ?? vacMin!;
  const budgetMin = vacMin ?? vacMax!;

  if (expectation <= budgetMax && (candMax ?? expectation) >= budgetMin) {
    return { score: 15, note: null };
  }
  if (expectation <= budgetMax * 1.08) {
    return { score: 10, note: "Salarisverwachting ligt net boven budget — bespreekbaar." };
  }
  if (expectation > budgetMax * 1.08) {
    return { score: 3, note: "Salarisverwachting boven vacaturebudget." };
  }
  return { score: 8, note: null };
}

export function computeCandidateMatch(
  vacancy: Vacancy,
  candidate: CandidateMatchInput,
): CandidateMatchResult {
  const roleFit = scoreRoleFit(vacancy, candidate);
  const skills = scoreSkillsFit(vacancy, candidate);
  const locationFit = scoreLocationFit(vacancy, candidate);
  const experienceFit = scoreExperienceFit(vacancy, candidate);
  const salary = scoreSalaryFit(vacancy, candidate);

  const breakdown: CandidateMatchBreakdown = {
    roleFit,
    skillsFit: skills.score,
    locationFit,
    experienceFit,
    salaryFit: salary.score,
  };

  const matchScore = Math.min(
    100,
    breakdown.roleFit
      + breakdown.skillsFit
      + breakdown.locationFit
      + breakdown.experienceFit
      + breakdown.salaryFit,
  );

  const strongPoints: string[] = [];
  if (skills.matched.length > 0) {
    strongPoints.push(`Sterke skill-match: ${skills.matched.slice(0, 4).join(", ")}.`);
  }
  if (breakdown.roleFit >= 18) {
    strongPoints.push(`Huidige rol sluit aan op ${vacancy.title}.`);
  }
  if (breakdown.experienceFit >= 12 && candidate.experienceYears != null) {
    strongPoints.push(`${candidate.experienceYears} jaar ervaring — passend bij het profiel.`);
  }
  if (breakdown.locationFit >= 12 && candidate.location) {
    strongPoints.push(`Locatie (${candidate.location}) sluit aan op de vacature.`);
  }
  if (breakdown.salaryFit >= 12) {
    strongPoints.push("Salarisverwachting valt binnen het vacaturebudget.");
  }
  if (candidate.availability && !/onbekend/i.test(candidate.availability)) {
    strongPoints.push(`Beschikbaarheid: ${candidate.availability}.`);
  }

  const risks: string[] = [];
  if (skills.missing.length > 0) {
    risks.push(`Mogelijk ontbrekend: ${skills.missing.slice(0, 3).join(", ")}.`);
  }
  if (salary.note) risks.push(salary.note);
  if (breakdown.locationFit <= 4 && vacancy.location && candidate.location) {
    risks.push(`Locatie mismatch: kandidaat (${candidate.location}) vs vacature (${vacancy.location}).`);
  }
  if (candidate.experienceYears == null) {
    risks.push("Ervaring niet volledig bekend — verifiëren in gesprek.");
  }
  if (!candidate.summary?.trim()) {
    risks.push("Beperkte profielinformatie — diepte-interview aanbevolen.");
  }
  if (breakdown.roleFit < 10) {
    risks.push("Roltitel wijkt af — check motivatie en transferable skills.");
  }

  const missingInfo: string[] = [];
  if (!candidate.availability) missingInfo.push("beschikbaarheid");
  if (candidate.salaryExpectationMin == null && candidate.salaryExpectationMax == null) {
    missingInfo.push("salarisverwachting");
  }
  if ((candidate.skills ?? []).length === 0) missingInfo.push("skills");
  if (!candidate.summary) missingInfo.push("profielsamenvatting");

  const filledFields = 6 - missingInfo.length;
  const confidence = Number(Math.min(0.95, 0.45 + filledFields * 0.08 + matchScore / 200).toFixed(2));

  if (strongPoints.length === 0) {
    strongPoints.push("Profiel deels passend — nadere screening nodig om fit te bevestigen.");
  }

  return candidateMatchResultSchema.parse({
    matchScore,
    breakdown,
    strongPoints: strongPoints.slice(0, 5),
    risks: risks.slice(0, 5),
    salaryExpectation: formatSalaryRange(
      candidate.salaryExpectationMin,
      candidate.salaryExpectationMax,
    ),
    availability: candidate.availability?.trim() || "Niet opgegeven — navragen",
    missingInfo,
    confidence,
  });
}

export function toCandidateMatchInput(profile: {
  firstName: string;
  lastName: string;
  candidateCurrentRole?: string | null;
  location?: string | null;
  summary?: string | null;
  skills?: string[];
  experienceYears?: number | null;
  salaryExpectationMin?: number | null;
  salaryExpectationMax?: number | null;
  availability?: string | null;
}): CandidateMatchInput {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    candidateCurrentRole: profile.candidateCurrentRole ?? null,
    location: profile.location ?? null,
    summary: profile.summary ?? null,
    skills: profile.skills ?? [],
    experienceYears: profile.experienceYears ?? null,
    salaryExpectationMin: profile.salaryExpectationMin ?? null,
    salaryExpectationMax: profile.salaryExpectationMax ?? null,
    availability: profile.availability ?? null,
  };
}
