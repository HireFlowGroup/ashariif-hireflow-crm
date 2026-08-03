import type {
  PriorityBreakdownPayload,
  PriorityComponents,
  PriorityFactor,
  PriorityProfile,
} from "@/features/priority-engine/domain/priority.types";
import {
  PRIORITY_COMPONENT_ORDER,
  type PriorityComponentKey,
} from "@/features/priority-engine/config/priority-engine.config";

const LEGACY_KEY_MAP: Record<string, PriorityComponentKey> = {
  urgency: "hiringUrgency",
  outreachPotential: "outreachDifficulty",
};

function emptyFactors(): Record<PriorityComponentKey, PriorityFactor[]> {
  return PRIORITY_COMPONENT_ORDER.reduce(
    (accumulator, key) => {
      accumulator[key] = [];
      return accumulator;
    },
    {} as Record<PriorityComponentKey, PriorityFactor[]>,
  );
}

function isPriorityBreakdownPayload(value: unknown): value is PriorityBreakdownPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.components !== undefined && typeof record.components === "object";
}

function mapLegacyFlatComponents(
  breakdown: Record<string, unknown>,
): PriorityComponents | null {
  const components = {} as PriorityComponents;
  let found = false;

  for (const key of PRIORITY_COMPONENT_ORDER) {
    const value = breakdown[key];
    if (typeof value === "number") {
      components[key] = value;
      found = true;
    }
  }

  for (const [legacyKey, modernKey] of Object.entries(LEGACY_KEY_MAP)) {
    const value = breakdown[legacyKey];
    if (typeof value === "number" && components[modernKey] === undefined) {
      if (legacyKey === "outreachPotential") {
        components[modernKey] = Math.max(0, 100 - value);
      } else {
        components[modernKey] = value;
      }
      found = true;
    }
  }

  return found ? components : null;
}

export function parsePriorityBreakdown(
  breakdown: Record<string, unknown> | null | undefined,
): PriorityBreakdownPayload | null {
  if (!breakdown) return null;

  if (isPriorityBreakdownPayload(breakdown)) {
    return breakdown as PriorityBreakdownPayload;
  }

  if (breakdown.components && typeof breakdown.components === "object") {
    const nested = breakdown.components as Record<string, unknown>;
    const components = mapLegacyFlatComponents(nested);
    if (components) {
      return {
        version: typeof breakdown.version === "string" ? breakdown.version : "legacy-nested",
        components,
        factors: (breakdown.factors as PriorityBreakdownPayload["factors"]) ?? emptyFactors(),
        weighted: Array.isArray(breakdown.weighted)
          ? (breakdown.weighted as PriorityBreakdownPayload["weighted"])
          : PRIORITY_COMPONENT_ORDER.map((key) => ({
              key,
              rawScore: components[key],
              effectiveScore: components[key],
              weight: 0,
              weightedScore: 0,
            })),
        compositeScore: typeof breakdown.compositeScore === "number" ? breakdown.compositeScore : 0,
        priority: (breakdown.priority as PriorityBreakdownPayload["priority"]) ?? "D",
        summary: typeof breakdown.summary === "string" ? breakdown.summary : "",
      };
    }
  }

  const components = mapLegacyFlatComponents(breakdown);
  if (!components) return null;

  return {
    version: "legacy-flat",
    components,
    factors: emptyFactors(),
    weighted: PRIORITY_COMPONENT_ORDER.map((key) => ({
      key,
      rawScore: components[key],
      effectiveScore: components[key],
      weight: 0,
      weightedScore: 0,
    })),
    compositeScore: typeof breakdown.compositeScore === "number" ? breakdown.compositeScore : 0,
    priority: "D",
    summary: typeof breakdown.summary === "string" ? breakdown.summary : "",
  };
}

export function parsePriorityProfile(
  breakdown: Record<string, unknown> | null | undefined,
  fallback?: {
    compositeScore: number | null;
    priority: PriorityProfile["priority"] | null;
    summary: string | null;
    modelVersion?: string | null;
  },
): PriorityProfile | null {
  const parsed = parsePriorityBreakdown(breakdown);
  if (!parsed) return null;

  const details = parsed.weighted.map((entry) => ({
    key: entry.key,
    label: entry.key,
    score: entry.rawScore,
    weight: entry.weight,
    weightedContribution: entry.weightedScore,
    factors: parsed.factors[entry.key] ?? [],
    effectiveScore: entry.effectiveScore,
  }));

  return {
    compositeScore: fallback?.compositeScore ?? parsed.compositeScore,
    priority: fallback?.priority ?? parsed.priority,
    components: parsed.components,
    details,
    summary: fallback?.summary ?? parsed.summary,
    modelVersion: fallback?.modelVersion ?? parsed.version,
    computedAt: new Date().toISOString(),
  };
}

export function parsePriorityComponents(
  breakdown: Record<string, unknown> | null | undefined,
): PriorityComponents | null {
  const parsed = parsePriorityBreakdown(breakdown);
  return parsed?.components ?? null;
}
