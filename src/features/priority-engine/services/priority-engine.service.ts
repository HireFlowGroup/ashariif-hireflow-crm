import { RELEVANT_VACANCY_KEYWORDS } from "@/features/lead-intelligence/domain";
import {
  getPriorityEngineConfig,
  INVERTED_PRIORITY_COMPONENTS,
  PRIORITY_COMPONENT_LABELS,
  PRIORITY_COMPONENT_ORDER,
  type PriorityComponentKey,
} from "@/features/priority-engine/config/priority-engine.config";
import type {
  PriorityBreakdownPayload,
  PriorityComponentDetail,
  PriorityComponents,
  PriorityFactor,
  PriorityInput,
  PriorityProfile,
} from "@/features/priority-engine/domain/priority.types";
import { priorityFromScore } from "@/features/priority-engine/domain/priority.types";

const GROWTH_SIGNAL_TYPES = new Set([
  "funding",
  "new_location",
  "news",
  "google_maps_change",
]);

const URGENCY_SIGNAL_TYPES = new Set([
  "vacancy",
  "indeed_vacancy",
  "linkedin_hiring",
  "new_recruiter",
  "new_hr_manager",
  "hiring_activity",
]);

const RECRUITMENT_SIGNAL_TYPES = new Set([
  "vacancy",
  "indeed_vacancy",
  "careers_page",
  "ats_detected",
  "linkedin_hiring",
  "werkenbij_listing",
]);

const DECISION_MAKER_KEYWORDS = [
  "ceo",
  "cfo",
  "coo",
  "founder",
  "owner",
  "director",
  "directeur",
  "managing",
  "oprichter",
  "eigenaar",
];

const HR_DECISION_KEYWORDS = [
  "hr",
  "human resources",
  "recruiter",
  "recruitment",
  "talent",
  "people",
  "hiring manager",
];

type ComponentComputation = {
  score: number;
  factors: PriorityFactor[];
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function addFactor(factors: PriorityFactor[], label: string, points: number) {
  if (points <= 0) return;
  factors.push({ label, points: Math.round(points) });
}

function computeRecruitmentActivity(input: PriorityInput): ComponentComputation {
  const factors: PriorityFactor[] = [];
  let score = 0;

  const vacancyPoints = Math.min(input.vacancyCount * 18, 45);
  addFactor(factors, `${input.vacancyCount} vacature(s) gedetecteerd`, vacancyPoints);
  score += vacancyPoints;

  const recruitmentSignals = input.hiringSignals.filter((signal) =>
    RECRUITMENT_SIGNAL_TYPES.has(signal.type),
  );
  const signalPoints = Math.min(recruitmentSignals.length * 12, 30);
  addFactor(factors, `${recruitmentSignals.length} recruitment signal(s)`, signalPoints);
  score += signalPoints;

  if (input.careersUrl || input.vacancyPageUrl) {
    addFactor(factors, "Careers/vacaturepagina aanwezig", 15);
    score += 15;
  }

  if (input.hiringSignals.some((signal) => signal.type === "ats_detected")) {
    addFactor(factors, "ATS gedetecteerd", 20);
    score += 20;
  }

  const relevantTitles = input.vacancyTitles.filter((title) =>
    RELEVANT_VACANCY_KEYWORDS.some((keyword) => title.toLowerCase().includes(keyword)),
  );
  const titlePoints = Math.min(relevantTitles.length * 8, 24);
  if (titlePoints > 0) {
    addFactor(factors, `${relevantTitles.length} relevante vacaturetitel(s)`, titlePoints);
    score += titlePoints;
  }

  if (factors.length === 0) {
    factors.push({ label: "Geen recruitment activiteit gedetecteerd", points: 0 });
  }

  return { score: clamp(score), factors };
}

function computeGrowth(input: PriorityInput): ComponentComputation {
  const factors: PriorityFactor[] = [];
  let score = 0;

  for (const signal of input.hiringSignals) {
    if (!GROWTH_SIGNAL_TYPES.has(signal.type)) continue;
    const points = signal.type === "funding" ? 35 : 18;
    addFactor(factors, `Groei-signaal: ${signal.type}`, points);
    score += points;
  }

  if ((input.signalCount ?? input.hiringSignals.length) > 3) {
    addFactor(factors, "Meerdere signals (>3)", 10);
    score += 10;
  }

  if (factors.length === 0) {
    factors.push({ label: "Geen groei-signalen", points: 0 });
  }

  return { score: clamp(score), factors };
}

function computeHiringUrgency(input: PriorityInput): ComponentComputation {
  const factors: PriorityFactor[] = [];
  let score = 0;

  if (input.hiringIntensity) {
    const intensityPoints = Math.min(input.hiringIntensity * 0.6, 40);
    addFactor(factors, `Hiring intensity ${input.hiringIntensity}`, intensityPoints);
    score += intensityPoints;
  }

  const urgencySignals = input.hiringSignals.filter((signal) =>
    URGENCY_SIGNAL_TYPES.has(signal.type),
  );
  const urgencyPoints = Math.min(urgencySignals.length * 14, 42);
  addFactor(factors, `${urgencySignals.length} urgentie-signaal(en)`, urgencyPoints);
  score += urgencyPoints;

  const highImportance = urgencySignals.filter((signal) => (signal.importance ?? 0) >= 80).length;
  if (highImportance > 0) {
    const importancePoints = highImportance * 6;
    addFactor(factors, `${highImportance} signal(s) met hoge importance`, importancePoints);
    score += importancePoints;
  }

  if (input.vacancyCount >= 3) {
    addFactor(factors, "3+ open vacatures", 15);
    score += 15;
  }

  if (factors.length === 0) {
    factors.push({ label: "Geen hiring urgentie gedetecteerd", points: 0 });
  }

  return { score: clamp(score), factors };
}

function computeDigitalPresence(input: PriorityInput): ComponentComputation {
  const factors: PriorityFactor[] = [];
  let score = 0;

  if (input.website) {
    addFactor(factors, "Website aanwezig", 30);
    score += 30;
  }
  if (input.domain) {
    addFactor(factors, "Domein bekend", 10);
    score += 10;
  }
  if (input.linkedinUrl) {
    addFactor(factors, "LinkedIn bedrijfspagina", 25);
    score += 25;
  }
  if (input.careersUrl || input.vacancyPageUrl) {
    addFactor(factors, "Werken-bij pagina", 20);
    score += 20;
  }
  if (input.kvkNumber) {
    addFactor(factors, "KVK-nummer bekend", 15);
    score += 15;
  }

  if (factors.length === 0) {
    factors.push({ label: "Beperkte digitale footprint", points: 0 });
  }

  return { score: clamp(score), factors };
}

function computeContactability(input: PriorityInput): ComponentComputation {
  const factors: PriorityFactor[] = [];
  let score = 0;

  if (input.hrEmail) {
    addFactor(factors, "HR e-mailadres", 35);
    score += 35;
  } else if (input.generalEmail || input.email) {
    addFactor(factors, "Algemeen e-mailadres", 25);
    score += 25;
  }

  if (input.phone) {
    addFactor(factors, "Telefoonnummer", 25);
    score += 25;
  }

  if (input.linkedinUrl) {
    addFactor(factors, "LinkedIn bedrijf", 15);
    score += 15;
  }

  const contactPoints = Math.min((input.contactCount ?? 0) * 10, 30);
  if (contactPoints > 0) {
    addFactor(factors, `${input.contactCount} contact(en) in CRM`, contactPoints);
    score += contactPoints;
  }

  if (factors.length === 0) {
    factors.push({ label: "Geen contactkanalen gevonden", points: 0 });
  }

  return { score: clamp(score), factors };
}

function computeDecisionMakerAvailability(input: PriorityInput): ComponentComputation {
  const factors: PriorityFactor[] = [];
  let score = 0;
  const contacts = input.contacts ?? [];

  const decisionMakers = contacts.filter((contact) => {
    const title = (contact.jobTitle ?? "").toLowerCase();
    return DECISION_MAKER_KEYWORDS.some((keyword) => title.includes(keyword));
  });

  if (decisionMakers.length > 0) {
    const points = Math.min(decisionMakers.length * 35, 45);
    addFactor(factors, `${decisionMakers.length} beslisser(s) in CRM`, points);
    score += points;
  }

  const hrLeads = contacts.filter((contact) => {
    const title = (contact.jobTitle ?? "").toLowerCase();
    return HR_DECISION_KEYWORDS.some((keyword) => title.includes(keyword));
  });

  if (hrLeads.length > 0) {
    const points = Math.min(hrLeads.length * 30, 40);
    addFactor(factors, `${hrLeads.length} HR/recruitment contact(en)`, points);
    score += points;
  }

  const reachable = contacts.filter(
    (contact) => contact.email || contact.phone || contact.linkedinUrl,
  );
  if (reachable.length > 0) {
    const points = Math.min(reachable.length * 8, 20);
    addFactor(factors, `${reachable.length} bereikbaar contact`, points);
    score += points;
  }

  const highConfidence = contacts.filter((contact) => (contact.confidence ?? 0) >= 0.7).length;
  if (highConfidence > 0) {
    addFactor(factors, `${highConfidence} contact(en) hoge betrouwbaarheid`, 10);
    score += 10;
  }

  const hrSignals = input.hiringSignals.filter((signal) =>
    ["new_hr_manager", "new_recruiter"].includes(signal.type),
  );
  if (hrSignals.length > 0) {
    addFactor(factors, "Nieuwe HR/recruiter hiring signal", 20);
    score += 20;
  }

  if (factors.length === 0) {
    factors.push({ label: "Geen beslisser of HR-contact gevonden", points: 0 });
  }

  return { score: clamp(score), factors };
}

function computeAiMatch(input: PriorityInput): ComponentComputation {
  const factors: PriorityFactor[] = [];
  const criteria = input.criteria;

  if (!criteria) {
    const fallback = clamp(input.confidence * 60);
    addFactor(factors, `Zoekcriteria ontbreken — confidence ${Math.round(input.confidence * 100)}%`, fallback);
    return { score: fallback, factors };
  }

  let score = 0;
  let factorsCount = 0;

  if (criteria.sector?.trim()) {
    factorsCount += 1;
    const sector = input.sector?.toLowerCase() ?? "";
    const target = criteria.sector.toLowerCase();
    let points = 10;
    if (sector === target) points = 100;
    else if (sector.includes(target) || target.includes(sector)) points = 75;
    addFactor(factors, `Sector match (${input.sector ?? "—"})`, points);
    score += points;
  }

  if (criteria.city?.trim()) {
    factorsCount += 1;
    const points = input.city?.toLowerCase().includes(criteria.city.toLowerCase()) ? 100 : 15;
    addFactor(factors, `Stad match (${input.city ?? "—"})`, points);
    score += points;
  }

  if (criteria.region?.trim()) {
    factorsCount += 1;
    const region = `${input.region ?? ""} ${input.city ?? ""}`.toLowerCase();
    const points = region.includes(criteria.region.toLowerCase()) ? 100 : 15;
    addFactor(factors, `Regio match`, points);
    score += points;
  }

  if (criteria.keywords?.trim()) {
    factorsCount += 1;
    const blob = `${input.name} ${input.sector ?? ""} ${input.vacancyTitles.join(" ")}`.toLowerCase();
    const hits = criteria.keywords
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => blob.includes(word.toLowerCase())).length;
    const points = hits > 0 ? Math.min(100, hits * 30) : 10;
    addFactor(factors, `${hits} keyword match(es)`, points);
    score += points;
  }

  if (factorsCount === 0) {
    const fallback = clamp(40 + input.confidence * 40);
    addFactor(factors, "Geen actieve zoekcriteria", fallback);
    return { score: fallback, factors };
  }

  return { score: clamp(score / factorsCount), factors };
}

function computeOutreachDifficulty(input: PriorityInput): ComponentComputation {
  const factors: PriorityFactor[] = [];
  let difficulty = 0;

  if (input.outreachStatus === "blocked") {
    addFactor(factors, "Outreach geblokkeerd", 40);
    difficulty += 40;
  } else if (input.outreachStatus === "sent") {
    addFactor(factors, "Outreach al verstuurd", 25);
    difficulty += 25;
  }

  if (!input.hrEmail && !input.generalEmail && !input.email) {
    addFactor(factors, "Geen e-mailadres", 25);
    difficulty += 25;
  }

  if (!input.phone) {
    addFactor(factors, "Geen telefoonnummer", 15);
    difficulty += 15;
  }

  if (!input.linkedinUrl) {
    addFactor(factors, "Geen LinkedIn bedrijfspagina", 10);
    difficulty += 10;
  }

  if (!input.domain && !input.website) {
    addFactor(factors, "Geen website/domein", 15);
    difficulty += 15;
  }

  if ((input.contactCount ?? 0) === 0) {
    addFactor(factors, "Geen contactpersonen in CRM", 15);
    difficulty += 15;
  }

  if (!input.source) {
    addFactor(factors, "Onbekende bron", 5);
    difficulty += 5;
  }

  if (factors.length === 0) {
    addFactor(factors, "Lage outreach-drempel", 5);
    difficulty = 5;
  }

  return { score: clamp(difficulty), factors };
}

const COMPONENT_CALCULATORS: Record<
  PriorityComponentKey,
  (input: PriorityInput) => ComponentComputation
> = {
  recruitmentActivity: computeRecruitmentActivity,
  growth: computeGrowth,
  hiringUrgency: computeHiringUrgency,
  digitalPresence: computeDigitalPresence,
  contactability: computeContactability,
  decisionMakerAvailability: computeDecisionMakerAvailability,
  aiMatch: computeAiMatch,
  outreachDifficulty: computeOutreachDifficulty,
};

function effectiveScore(key: PriorityComponentKey, rawScore: number): number {
  return INVERTED_PRIORITY_COMPONENTS.has(key) ? 100 - rawScore : rawScore;
}

function buildSummary(details: PriorityComponentDetail[], priority: PriorityProfile["priority"]): string {
  const ranked = [...details]
    .sort((left, right) => right.weightedContribution - left.weightedContribution)
    .slice(0, 3);

  const highlights = ranked
    .map((detail) => {
      const topFactor = detail.factors[0];
      const factorHint = topFactor && topFactor.points > 0 ? ` — ${topFactor.label}` : "";
      return `${detail.label} (${detail.score})${factorHint}`;
    })
    .join("; ");

  return `Priority ${priority}: ${highlights}.`;
}

function computeWeightedDetails(
  components: PriorityComponents,
  factorMap: Record<PriorityComponentKey, PriorityFactor[]>,
  weights: Record<PriorityComponentKey, number>,
): PriorityComponentDetail[] {
  const weightSum = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 100;

  return PRIORITY_COMPONENT_ORDER.map((key) => {
    const rawScore = components[key];
    const effective = effectiveScore(key, rawScore);
    const weight = weights[key];
    const weightedContribution = (effective * weight) / weightSum;

    return {
      key,
      label: PRIORITY_COMPONENT_LABELS[key],
      score: rawScore,
      weight,
      weightedContribution: Math.round(weightedContribution * 10) / 10,
      factors: factorMap[key],
      effectiveScore: effective,
    };
  });
}

/** Deterministic Priority Engine — no GPT. */
export function computePriority(input: PriorityInput): PriorityProfile {
  const config = getPriorityEngineConfig();

  const components = {} as PriorityComponents;
  const factorMap = {} as Record<PriorityComponentKey, PriorityFactor[]>;

  for (const key of PRIORITY_COMPONENT_ORDER) {
    const result = COMPONENT_CALCULATORS[key](input);
    components[key] = result.score;
    factorMap[key] = result.factors;
  }

  const details = computeWeightedDetails(components, factorMap, config.weights);
  const compositeScore = clamp(
    details.reduce((sum, detail) => sum + detail.weightedContribution, 0),
  );
  const priority = priorityFromScore(compositeScore, config.priorityThresholds);

  return {
    compositeScore,
    priority,
    components,
    details,
    summary: buildSummary(details, priority),
    modelVersion: config.modelVersion,
    computedAt: new Date().toISOString(),
  };
}

export function priorityProfileToBreakdown(profile: PriorityProfile): PriorityBreakdownPayload {
  return {
    version: profile.modelVersion,
    components: profile.components,
    factors: Object.fromEntries(
      profile.details.map((detail) => [detail.key, detail.factors]),
    ) as Record<PriorityComponentKey, PriorityFactor[]>,
    weighted: profile.details.map((detail) => ({
      key: detail.key,
      rawScore: detail.score,
      effectiveScore: detail.effectiveScore,
      weight: detail.weight,
      weightedScore: detail.weightedContribution,
    })),
    compositeScore: profile.compositeScore,
    priority: profile.priority,
    summary: profile.summary,
  };
}

export function priorityInputFromCandidate(
  candidate: import("@/features/lead-intelligence/domain").ExternalCompanyCandidate,
  criteria?: PriorityInput["criteria"],
  extras?: Partial<
    Pick<
      PriorityInput,
      "contactCount" | "hiringIntensity" | "signalCount" | "outreachStatus" | "contacts"
    >
  >,
): PriorityInput {
  return {
    name: candidate.name,
    sector: candidate.sector,
    city: candidate.city,
    region: candidate.region,
    website: candidate.website,
    domain: candidate.domain,
    linkedinUrl: candidate.linkedinUrl,
    email: candidate.email,
    generalEmail: candidate.generalEmail,
    hrEmail: candidate.hrEmail,
    phone: candidate.phone,
    careersUrl: candidate.careersUrl,
    vacancyPageUrl: candidate.vacancyPageUrl,
    kvkNumber: candidate.kvkNumber,
    vacancyCount: candidate.vacancyCount,
    vacancyTitles: candidate.vacancyTitles,
    hiringSignals: candidate.hiringSignals.map((signal) => ({
      type: signal.type,
      description: signal.description,
      confidence: signal.confidence,
    })),
    confidence: candidate.confidence,
    source: candidate.source,
    criteria,
    ...extras,
  };
}
