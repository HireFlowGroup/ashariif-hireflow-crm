import type { PriorityComponents } from "@/features/priority-engine";
import {
  parsePriorityBreakdown,
  parsePriorityComponents,
} from "@/features/priority-engine/services/parse-priority-breakdown";

/** @deprecated Use parsePriorityComponents */
export function parseScoreComponents(
  breakdown: Record<string, unknown> | null | undefined,
): PriorityComponents | null {
  return parsePriorityComponents(breakdown);
}

export { parsePriorityBreakdown, parsePriorityComponents };

export function isLeadScoreExplanation(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.length > 40 && !text.startsWith("Priority ");
}
