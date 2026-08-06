export const PROSPECT_SCORING_VERSION = "2026-08-05-v1";

export type ProspectDecision = "HOT" | "WARM" | "REVIEW" | "IGNORE";
export type ProspectPriority = "A" | "B" | "C" | "LOW";

export type ProspectDecisionResult = {
  score: number;
  decision: ProspectDecision;
  priority: ProspectPriority;
  decisionReason: string;
  scoringVersion: string;
  evaluatedAt: string;
};

export type ProspectDecisionThresholds = {
  hotMin: number;
  warmMin: number;
  reviewMin: number;
};

const DEFAULT_THRESHOLDS: ProspectDecisionThresholds = {
  hotMin: parseInt(process.env.AI_RECRUITER_DECISION_HOT_MIN ?? "80", 10),
  warmMin: parseInt(process.env.AI_RECRUITER_DECISION_WARM_MIN ?? "60", 10),
  reviewMin: parseInt(process.env.AI_RECRUITER_DECISION_REVIEW_MIN ?? "30", 10),
};

/** Single source of truth: deterministic score → decision + priority. */
export function mapScoreToDecision(
  score: number,
  thresholds: ProspectDecisionThresholds = DEFAULT_THRESHOLDS,
): ProspectDecisionResult {
  const evaluatedAt = new Date().toISOString();

  if (score >= thresholds.hotMin) {
    return {
      score,
      decision: "HOT",
      priority: "A",
      decisionReason: `Score ${score} ≥ ${thresholds.hotMin} (HOT)`,
      scoringVersion: PROSPECT_SCORING_VERSION,
      evaluatedAt,
    };
  }

  if (score >= thresholds.warmMin) {
    return {
      score,
      decision: "WARM",
      priority: "B",
      decisionReason: `Score ${score} ≥ ${thresholds.warmMin} (WARM)`,
      scoringVersion: PROSPECT_SCORING_VERSION,
      evaluatedAt,
    };
  }

  if (score >= thresholds.reviewMin) {
    return {
      score,
      decision: "REVIEW",
      priority: "C",
      decisionReason: `Score ${score} ≥ ${thresholds.reviewMin} (REVIEW)`,
      scoringVersion: PROSPECT_SCORING_VERSION,
      evaluatedAt,
    };
  }

  return {
    score,
    decision: "IGNORE",
    priority: "LOW",
    decisionReason: `Score ${score} < ${thresholds.reviewMin} (IGNORE)`,
    scoringVersion: PROSPECT_SCORING_VERSION,
    evaluatedAt,
  };
}

export function prospectDecisionToBreakdownFields(result: ProspectDecisionResult) {
  return {
    decision: result.decision,
    priority: result.priority,
    decisionReason: result.decisionReason,
    scoringVersion: result.scoringVersion,
    evaluatedAt: result.evaluatedAt,
  };
}

export function formatDecisionLabel(decision: ProspectDecision | undefined | null): string {
  switch (decision) {
    case "HOT":
      return "HOT";
    case "WARM":
      return "WARM";
    case "REVIEW":
      return "REVIEW";
    case "IGNORE":
      return "IGNORE";
    default:
      return "—";
  }
}
