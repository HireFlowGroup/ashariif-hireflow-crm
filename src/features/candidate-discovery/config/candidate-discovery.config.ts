import "server-only";

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Candidate Discovery — safe-by-default; geen DB/API in fase 1. */
export function getCandidateDiscoveryConfig() {
  return {
    enabled: process.env.CANDIDATE_DISCOVERY_ENABLED !== "false",
    maxCandidates: parsePositiveInt(process.env.CANDIDATE_DISCOVERY_MAX_CANDIDATES, 5),
    maxQueries: Math.min(3, parsePositiveInt(process.env.CANDIDATE_DISCOVERY_MAX_QUERIES, 3)),
    maxResultsPerQuery: parsePositiveInt(process.env.CANDIDATE_DISCOVERY_MAX_RESULTS_PER_QUERY, 8),
    minMatchScore: parsePositiveInt(process.env.CANDIDATE_DISCOVERY_MIN_MATCH_SCORE, 45),
    runTimeoutMs: parsePositiveInt(process.env.CANDIDATE_DISCOVERY_RUN_TIMEOUT_MS, 45_000),
    linkedInProfileSiteConstraint: "site:linkedin.com/in",
  } as const;
}

export type CandidateDiscoveryConfig = ReturnType<typeof getCandidateDiscoveryConfig>;