import { getServerEnv } from "@/platform/config/env";

export type FeatureFlag =
  | "recruitment_assistant"
  | "outreach_intelligence"
  | "recruitment_rag"
  | "daily_intelligence"
  | "provider_manager"
  | "ai_audit_logging"
  | "platform_events"
  | "api_rate_limiting";

const ENV_MAP: Record<FeatureFlag, keyof ReturnType<typeof getServerEnv> | null> = {
  recruitment_assistant: "FEATURE_RECRUITMENT_ASSISTANT",
  outreach_intelligence: "FEATURE_OUTREACH_INTELLIGENCE",
  recruitment_rag: "FEATURE_RECRUITMENT_RAG",
  daily_intelligence: "FEATURE_DAILY_INTELLIGENCE",
  provider_manager: "FEATURE_PROVIDER_MANAGER",
  ai_audit_logging: null,
  platform_events: null,
  api_rate_limiting: null,
};

/** Defaults — enabled unless explicitly disabled via env. */
const DEFAULTS: Record<FeatureFlag, boolean> = {
  recruitment_assistant: true,
  outreach_intelligence: true,
  recruitment_rag: true,
  daily_intelligence: true,
  provider_manager: true,
  ai_audit_logging: true,
  platform_events: true,
  api_rate_limiting: true,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const env = getServerEnv();
  const key = ENV_MAP[flag];

  if (key) {
    const value = env[key];
    if (value === true) return true;
    if (value === false) return false;
  }

  return DEFAULTS[flag];
}

export function requireFeature(flag: FeatureFlag): void {
  if (!isFeatureEnabled(flag)) {
    throw new Error(`Feature "${flag}" is disabled.`);
  }
}
