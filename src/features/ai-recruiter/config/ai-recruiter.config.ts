import "server-only";

/** AI Recruiter configuration — safe-by-default. */
export function getAiRecruiterConfig() {
  return {
    approvalMode: (process.env.AI_RECRUITER_APPROVAL_MODE ?? "manual") as "manual" | "automatic",
    sendEnabled: process.env.AI_RECRUITER_SEND_ENABLED === "true",
    runTimeoutMinutes: parseInt(process.env.AI_RECRUITER_RUN_TIMEOUT_MINUTES ?? "45", 10),
    maxConcurrentItems: parseInt(process.env.AI_RECRUITER_MAX_CONCURRENT_ITEMS ?? "3", 10),
    consecutiveProviderFailuresKillSwitch: parseInt(
      process.env.AI_RECRUITER_PROVIDER_FAILURE_KILL_SWITCH ?? "3",
      10,
    ),
    defaultMaximumCompanies: parseInt(process.env.AI_RECRUITER_DEFAULT_MAX_COMPANIES ?? "25", 10),
    defaultMaximumDrafts: parseInt(process.env.AI_RECRUITER_DEFAULT_MAX_DRAFTS ?? "10", 10),
    /** Minimum deterministic score (0–100) to allow concept generation. */
    conceptScoreThreshold: parseInt(process.env.AI_RECRUITER_CONCEPT_SCORE_THRESHOLD ?? "30", 10),
    /** Minimum queries per search plan (vacancy-driven discovery). */
    minDiscoveryQueries: parseInt(process.env.AI_RECRUITER_MIN_DISCOVERY_QUERIES ?? "5", 10),
    /** Max results per individual discovery query. */
    maxResultsPerQuery: parseInt(process.env.AI_RECRUITER_MAX_RESULTS_PER_QUERY ?? "10", 10),
  };
}
