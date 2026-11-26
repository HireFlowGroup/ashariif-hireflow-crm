import type {
  DiscoveryRejectionReason,
  DiscoverySaveStatus,
} from "@/features/company-finder/discovery/discovery-quality.types";
import {
  DISCOVERY_ACCEPT_CONFIDENCE,
  DISCOVERY_REVIEW_CONFIDENCE_MIN,
} from "@/features/company-finder/discovery/discovery-quality.types";

export type DiscoveryDecisionInput = {
  verdict: "company" | "not_company";
  confidence: number;
  hasCompanyAcceptanceSignal: boolean;
};

export type DiscoveryDecisionOutcome =
  | { action: "accept"; saveStatus: DiscoverySaveStatus; confidence: number }
  | { action: "reject"; reason: DiscoveryRejectionReason; detail: string; confidence: number };

/**
 * Pure decision rules for Company Finder classification.
 * AI confidence >70 always accepts; 50–70 → Review with company signals;
 * otherwise reject with an exact reason.
 */
export function evaluateDiscoveryDecision(input: DiscoveryDecisionInput): DiscoveryDecisionOutcome {
  const confidence = input.confidence;

  if (input.verdict !== "company") {
    return {
      action: "reject",
      reason: "low_confidence",
      detail: `AI: not_company (confidence ${confidence})`,
      confidence,
    };
  }

  if (confidence > DISCOVERY_ACCEPT_CONFIDENCE) {
    return { action: "accept", saveStatus: "company", confidence };
  }

  if (confidence >= DISCOVERY_REVIEW_CONFIDENCE_MIN && confidence <= DISCOVERY_ACCEPT_CONFIDENCE) {
    if (!input.hasCompanyAcceptanceSignal) {
      return {
        action: "reject",
        reason: "missing_company_signals",
        detail: `Geen bedrijfsignal; AI confidence ${confidence}`,
        confidence,
      };
    }

    return { action: "accept", saveStatus: "review", confidence };
  }

  return {
    action: "reject",
    reason: "low_confidence",
    detail: `AI confidence ${confidence} onder drempel ${DISCOVERY_REVIEW_CONFIDENCE_MIN}`,
    confidence,
  };
}
