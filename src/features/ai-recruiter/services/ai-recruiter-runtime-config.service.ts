import "server-only";

import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";

export type AiRecruiterRuntimeConfigIssueLevel = "error" | "warning";

export type AiRecruiterRuntimeConfigIssue = {
  level: AiRecruiterRuntimeConfigIssueLevel;
  code: string;
  message: string;
};

export type AiRecruiterRuntimeConfigSnapshot = {
  supabaseProjectRef: string | null;
  discovery: {
    maxHttpAttemptsPerRun: number;
    maxHttpSerpapi: number;
    maxHttpTavily: number;
    maxHttpOther: number;
    queryCount: number;
    minDiscoveryQueries: number;
    resultsPerQuery: number;
    concurrency: number;
  };
  caps: {
    defaultMaximumCompanies: number;
    defaultMaximumDrafts: number;
    planLimitMaximumCompanies: number;
    planLimitMaximumDrafts: number;
  };
  outreach: {
    sendEnabled: boolean;
    approvalMode: string;
  };
  issues: AiRecruiterRuntimeConfigIssue[];
  failClosed: boolean;
};

function supabaseProjectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

/** Validates effective runtime knobs (not raw process.env duplicates). */
export function buildAiRecruiterRuntimeConfigSnapshot(options?: {
  requireTestProject?: boolean;
}): AiRecruiterRuntimeConfigSnapshot {
  const config = getAiRecruiterConfig();
  const issues: AiRecruiterRuntimeConfigIssue[] = [];
  const projectRef = supabaseProjectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (options?.requireTestProject && projectRef !== "vcmegbghsaqagikfxces") {
    issues.push({
      level: "error",
      code: "wrong_supabase_project",
      message: `Verwacht testproject vcmegbghsaqagikfxces, actief: ${projectRef ?? "onbekend"}`,
    });
  }

  if (config.minDiscoveryQueries > config.discoveryQueryCount) {
    issues.push({
      level: "error",
      code: "discovery_query_min_exceeds_target",
      message: `MIN_DISCOVERY_QUERIES (${config.minDiscoveryQueries}) > DISCOVERY_QUERY_COUNT (${config.discoveryQueryCount})`,
    });
  }

  const theoreticalMaxHttp =
    config.discoveryQueryCount
    * Math.max(config.discoveryMaxProviderAttemptsPerQuery, 1)
    * 2;
  if (theoreticalMaxHttp > config.discoveryMaxHttpAttemptsPerRun) {
    issues.push({
      level: "warning",
      code: "theoretical_http_exceeds_run_cap",
      message: `Theoretisch HTTP (${theoreticalMaxHttp}) kan run-cap (${config.discoveryMaxHttpAttemptsPerRun}) overschrijden — budgetbewaking moet fail-closed zijn.`,
    });
  }

  if (config.sendEnabled) {
    issues.push({
      level: "error",
      code: "send_enabled_in_test",
      message: "AI_RECRUITER_SEND_ENABLED=true is niet toegestaan in geïsoleerde QA.",
    });
  }

  const failClosed = issues.some((issue) => issue.level === "error");

  return {
    supabaseProjectRef: projectRef,
    discovery: {
      maxHttpAttemptsPerRun: config.discoveryMaxHttpAttemptsPerRun,
      maxHttpSerpapi: config.discoveryMaxHttpAttemptsSerpapi,
      maxHttpTavily: config.discoveryMaxHttpAttemptsTavily,
      maxHttpOther: config.discoveryMaxHttpAttemptsOtherProviders,
      queryCount: config.discoveryQueryCount,
      minDiscoveryQueries: config.minDiscoveryQueries,
      resultsPerQuery: config.resultsPerQuery,
      concurrency: config.discoveryConcurrency,
    },
    caps: {
      defaultMaximumCompanies: config.defaultMaximumCompanies,
      defaultMaximumDrafts: config.defaultMaximumDrafts,
      planLimitMaximumCompanies: config.planLimitMaximumCompanies,
      planLimitMaximumDrafts: config.planLimitMaximumDrafts,
    },
    outreach: {
      sendEnabled: config.sendEnabled,
      approvalMode: config.approvalMode,
    },
    issues,
    failClosed,
  };
}

export function assertAiRecruiterRuntimeConfigReady(options?: { requireTestProject?: boolean }): void {
  const snapshot = buildAiRecruiterRuntimeConfigSnapshot(options);
  if (!snapshot.failClosed) return;
  const summary = snapshot.issues
    .filter((i) => i.level === "error")
    .map((i) => i.message)
    .join("; ");
  throw new Error(`AI Recruiter runtime-config ongeldig: ${summary}`);
}