/**
 * Lead scoring types — backed by Priority Engine.
 */

import type {
  PriorityComponentKey,
  PriorityComponents,
  PriorityFactor,
  PriorityInput,
  PriorityProfile,
} from "@/features/priority-engine";

export type LeadPriority = "A" | "B" | "C" | "D";

/** Deterministic component scores (each 0–100). */
export type LeadScoreComponents = PriorityComponents;

export type WeightedComponentScore = {
  key: PriorityComponentKey;
  label: string;
  rawScore: number;
  weight: number;
  weightedScore: number;
};

export type LeadScoreResult = {
  score: number;
  priority: LeadPriority;
  components: LeadScoreComponents;
  weightedComponents: WeightedComponentScore[];
  scoreReason: string;
  explanation: string | null;
  modelVersion: string;
  scoredAt: string;
  priorityProfile?: PriorityProfile;
};

/** @deprecated Use PriorityInput */
export type LeadScoreInput = PriorityInput;

export type { PriorityFactor, PriorityProfile };

export { priorityColorClass, priorityFromScore } from "@/features/priority-engine";

export function priorityLabel(priority: LeadPriority): string {
  return `Priority ${priority}`;
}
