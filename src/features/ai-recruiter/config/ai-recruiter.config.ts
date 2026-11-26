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
    /** Hard server ceiling for maximum_companies (independent of LLM / UI). */
    planLimitMaximumCompanies: parseInt(
      process.env.AI_RECRUITER_PLAN_LIMIT_MAXIMUM_COMPANIES ??
        process.env.AI_RECRUITER_DEFAULT_MAX_COMPANIES ??
        "25",
      10,
    ),
    /** Hard server ceiling for maximum_drafts (independent of LLM / UI). */
    planLimitMaximumDrafts: parseInt(
      process.env.AI_RECRUITER_PLAN_LIMIT_MAXIMUM_DRAFTS ??
        process.env.AI_RECRUITER_DEFAULT_MAX_DRAFTS ??
        "10",
      10,
    ),
    /** Minimum deterministic score (0–100) to allow concept generation. */
    conceptScoreThreshold: parseInt(process.env.AI_RECRUITER_CONCEPT_SCORE_THRESHOLD ?? "30", 10),
    /** Minimum queries per search plan (vacancy-driven discovery). */
    minDiscoveryQueries: parseInt(process.env.AI_RECRUITER_MIN_DISCOVERY_QUERIES ?? "5", 10),
    /** Target number of discovery queries per run. */
    discoveryQueryCount: parseInt(process.env.AI_RECRUITER_DISCOVERY_QUERY_COUNT ?? "12", 10),
    /** Max results per individual discovery query. */
    maxResultsPerQuery: parseInt(process.env.AI_RECRUITER_RESULTS_PER_QUERY ?? "10", 10),
    /** @deprecated alias */
    resultsPerQuery: parseInt(process.env.AI_RECRUITER_RESULTS_PER_QUERY ?? "10", 10),
    /** Concurrent discovery queries. */
    discoveryConcurrency: parseInt(process.env.AI_RECRUITER_DISCOVERY_CONCURRENCY ?? "4", 10),
    /** Max search providers to try per discovery query (failover chain). */
    discoveryMaxProviderAttemptsPerQuery: parseInt(
      process.env.AI_RECRUITER_DISCOVERY_MAX_PROVIDER_ATTEMPTS ?? "3",
      10,
    ),
    /** Extra SerpAPI gap-fill queries (0 = disabled for P0 cost caps). */
    discoverySupplementalQueryCap: parseInt(
      process.env.AI_RECRUITER_DISCOVERY_SUPPLEMENTAL_QUERY_CAP ?? "0",
      10,
    ),
    /** Include vacancy board site: queries. */
    includeVacancySources: process.env.AI_RECRUITER_INCLUDE_VACANCY_SOURCES !== "false",
    /** Exclude recruitment/staffing agencies as competitors. */
    excludeRecruitmentAgencies: process.env.AI_RECRUITER_EXCLUDE_RECRUITMENT_AGENCIES !== "false",
    /** Max deterministic enrichment steps per prospect (P0-R2). */
    prospectEnrichmentMaxSteps: parseInt(
      process.env.AI_RECRUITER_PROSPECT_ENRICHMENT_MAX_STEPS ?? "4",
      10,
    ),
    /** Max paid provider calls during prospect enrichment (excl. discovery). */
    prospectEnrichmentMaxProviderCalls: parseInt(
      process.env.AI_RECRUITER_PROSPECT_ENRICHMENT_MAX_PROVIDER_CALLS ?? "1",
      10,
    ),
    /** Hard cap on outbound search HTTP calls per AI Recruiter discovery run. */
    discoveryMaxHttpAttemptsPerRun: parseInt(
      process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN ?? "12",
      10,
    ),
    discoveryMaxHttpAttemptsTavily: parseInt(
      process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_TAVILY ?? "3",
      10,
    ),
    discoveryMaxHttpAttemptsSerpapi: parseInt(
      process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI ?? "6",
      10,
    ),
    discoveryMaxHttpAttemptsOtherProviders: parseInt(
      process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_OTHER ?? "4",
      10,
    ),
  };
}
