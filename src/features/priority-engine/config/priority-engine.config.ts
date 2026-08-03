/**
 * Priority Engine — deterministic multi-axis scoring.
 * Configure weights & thresholds via environment variables (no GPT).
 */

export type PriorityComponentKey =
  | "recruitmentActivity"
  | "growth"
  | "hiringUrgency"
  | "digitalPresence"
  | "contactability"
  | "decisionMakerAvailability"
  | "aiMatch"
  | "outreachDifficulty";

export type PriorityWeights = Record<PriorityComponentKey, number>;

export type PriorityEngineConfig = {
  weights: PriorityWeights;
  priorityThresholds: {
    A: number;
    B: number;
    C: number;
  };
  modelVersion: string;
};

/** Components where a lower raw score is better for composite (inverted in weighting). */
export const INVERTED_PRIORITY_COMPONENTS = new Set<PriorityComponentKey>(["outreachDifficulty"]);

function envInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envWeight(key: string, fallback: number): number {
  return Math.max(0, Math.min(100, envInt(key, fallback)));
}

export function getPriorityEngineConfig(): PriorityEngineConfig {
  const legacyUrgency = envWeight("LEAD_SCORE_WEIGHT_URGENCY", 15);
  const legacyOutreach = envWeight("LEAD_SCORE_WEIGHT_OUTREACH_POTENTIAL", 10);

  const weights: PriorityWeights = {
    recruitmentActivity: envWeight("PRIORITY_WEIGHT_RECRUITMENT_ACTIVITY", envWeight("LEAD_SCORE_WEIGHT_RECRUITMENT_ACTIVITY", 18)),
    growth: envWeight("PRIORITY_WEIGHT_GROWTH", envWeight("LEAD_SCORE_WEIGHT_GROWTH", 10)),
    hiringUrgency: envWeight("PRIORITY_WEIGHT_HIRING_URGENCY", legacyUrgency),
    digitalPresence: envWeight("PRIORITY_WEIGHT_DIGITAL_PRESENCE", envWeight("LEAD_SCORE_WEIGHT_DIGITAL_PRESENCE", 8)),
    contactability: envWeight("PRIORITY_WEIGHT_CONTACTABILITY", envWeight("LEAD_SCORE_WEIGHT_CONTACTABILITY", 12)),
    decisionMakerAvailability: envWeight("PRIORITY_WEIGHT_DECISION_MAKER", 12),
    aiMatch: envPriorityWeight("PRIORITY_WEIGHT_AI_MATCH", "LEAD_SCORE_WEIGHT_AI_MATCH", 15),
    outreachDifficulty: envWeight("PRIORITY_WEIGHT_OUTREACH_DIFFICULTY", legacyOutreach),
  };

  return {
    weights,
    priorityThresholds: {
      A: envInt("PRIORITY_THRESHOLD_A_MIN", envInt("LEAD_SCORE_PRIORITY_A_MIN", 85)),
      B: envInt("PRIORITY_THRESHOLD_B_MIN", envInt("LEAD_SCORE_PRIORITY_B_MIN", 70)),
      C: envInt("PRIORITY_THRESHOLD_C_MIN", envInt("LEAD_SCORE_PRIORITY_C_MIN", 50)),
    },
    modelVersion: process.env.PRIORITY_ENGINE_MODEL_VERSION ?? process.env.LEAD_SCORE_MODEL_VERSION ?? "priority-engine-v1",
  };
}

function envPriorityWeight(primary: string, fallbackKey: string, defaultValue: number): number {
  if (process.env[primary]) return envWeight(primary, defaultValue);
  return envWeight(fallbackKey, defaultValue);
}

export const PRIORITY_COMPONENT_LABELS: Record<PriorityComponentKey, string> = {
  recruitmentActivity: "Recruitment Activity",
  growth: "Growth",
  hiringUrgency: "Hiring Urgency",
  digitalPresence: "Digital Presence",
  contactability: "Contactability",
  decisionMakerAvailability: "Decision Maker Availability",
  aiMatch: "AI Match",
  outreachDifficulty: "Outreach Difficulty",
};

export const PRIORITY_COMPONENT_LABELS_NL: Record<PriorityComponentKey, string> = {
  recruitmentActivity: "Recruitmentactiviteit",
  growth: "Groei",
  hiringUrgency: "Hiring urgentie",
  digitalPresence: "Digitale aanwezigheid",
  contactability: "Bereikbaarheid",
  decisionMakerAvailability: "Beslisser beschikbaar",
  aiMatch: "AI Match",
  outreachDifficulty: "Outreach moeilijkheid",
};

export const PRIORITY_COMPONENT_ORDER: PriorityComponentKey[] = [
  "recruitmentActivity",
  "growth",
  "hiringUrgency",
  "digitalPresence",
  "contactability",
  "decisionMakerAvailability",
  "aiMatch",
  "outreachDifficulty",
];
