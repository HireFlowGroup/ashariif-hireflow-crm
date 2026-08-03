/** Daily Hiring Intelligence Scheduler configuration. */

export type DailySchedulerConfig = {
  enabled: boolean;
  cronSecretRequired: boolean;
  companiesPerBatch: number;
  workerBatchSize: number;
  maxConcurrentChecks: number;
  delayBetweenCompaniesMs: number;
  delayBetweenChecksMs: number;
  staleJobMinutes: number;
  maxAttempts: number;
  scoreChangeThreshold: number;
  notifyOnSignalCreate: boolean;
  notifyOnScoreChange: boolean;
};

function envInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

export function getDailySchedulerConfig(): DailySchedulerConfig {
  return {
    enabled: envBool("DAILY_INTELLIGENCE_ENABLED", true),
    cronSecretRequired: envBool("DAILY_INTELLIGENCE_CRON_SECRET_REQUIRED", true),
    companiesPerBatch: envInt("DAILY_INTELLIGENCE_COMPANIES_PER_BATCH", 100),
    workerBatchSize: envInt("DAILY_INTELLIGENCE_WORKER_BATCH_SIZE", 5),
    maxConcurrentChecks: envInt("DAILY_INTELLIGENCE_MAX_CONCURRENT_CHECKS", 3),
    delayBetweenCompaniesMs: envInt("DAILY_INTELLIGENCE_DELAY_COMPANY_MS", 2000),
    delayBetweenChecksMs: envInt("DAILY_INTELLIGENCE_DELAY_CHECK_MS", 800),
    staleJobMinutes: envInt("DAILY_INTELLIGENCE_STALE_JOB_MINUTES", 30),
    maxAttempts: envInt("DAILY_INTELLIGENCE_MAX_ATTEMPTS", 3),
    scoreChangeThreshold: envInt("DAILY_INTELLIGENCE_SCORE_CHANGE_THRESHOLD", 5),
    notifyOnSignalCreate: envBool("DAILY_INTELLIGENCE_NOTIFY_SIGNAL_CREATE", true),
    notifyOnScoreChange: envBool("DAILY_INTELLIGENCE_NOTIFY_SCORE_CHANGE", true),
  };
}

export const NIGHTLY_CHECK_TYPES = [
  "vacancy",
  "indeed_vacancy",
  "new_recruiter",
  "new_hr_manager",
  "new_location",
  "website_change",
  "news",
  "linkedin_hiring",
  "ats_detected",
  "careers_page",
] as const;

export type NightlyCheckType = (typeof NIGHTLY_CHECK_TYPES)[number];

export const CHECK_TYPE_TO_NOTIFICATION: Record<string, string> = {
  vacancy: "new_vacancy",
  indeed_vacancy: "new_vacancy",
  new_recruiter: "new_recruiter",
  new_hr_manager: "new_hr_manager",
  new_location: "new_location",
  website_change: "website_change",
  news: "news",
  linkedin_hiring: "linkedin_change",
  ats_detected: "ats_detected",
  careers_page: "new_vacancy",
};
