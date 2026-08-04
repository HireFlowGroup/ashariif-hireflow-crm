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
  };
}
