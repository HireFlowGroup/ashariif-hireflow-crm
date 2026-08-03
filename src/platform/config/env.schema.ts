import { z } from "zod";

const optionalInt = z
  .string()
  .optional()
  .transform((value) => (value ? parseInt(value, 10) : undefined))
  .pipe(z.number().int().optional());

const optionalBool = z
  .string()
  .optional()
  .transform((value): boolean | undefined => {
    if (value === undefined) return undefined;
    return value === "true" || value === "1";
  });

/** Public env — validated at build/runtime on client boundaries. */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

/** Server env — fail-fast validation for production intelligence stack. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  WORKER_SECRET: z.string().min(16).optional(),

  // Observability
  OTEL_ENABLED: optionalBool,
  OTEL_SERVICE_NAME: z.string().default("hireflow-ai"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Platform tuning
  API_RATE_LIMIT_PER_MINUTE: optionalInt,
  PLATFORM_CACHE_TTL_MS: optionalInt,
  PLATFORM_MAX_RETRIES: optionalInt,

  // Feature flags (env overrides)
  FEATURE_RECRUITMENT_ASSISTANT: optionalBool,
  FEATURE_OUTREACH_INTELLIGENCE: optionalBool,
  FEATURE_RECRUITMENT_RAG: optionalBool,
  FEATURE_DAILY_INTELLIGENCE: optionalBool,
  FEATURE_PROVIDER_MANAGER: optionalBool,

  // Vault master key (production — per-provider keys stored encrypted in Supabase)
  PROVIDER_SECRETS_ENCRYPTION_KEY: z.string().min(32).optional(),
  TAVILY_API_KEY: z.string().optional(),
  WEB_SEARCH_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  SERPAPI_API_KEY: z.string().optional(),
  GOOGLE_CSE_API_KEY: z.string().optional(),
  GOOGLE_CSE_CX: z.string().optional(),
  BING_SEARCH_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  PLAYWRIGHT_CRAWLER_ENABLED: optionalBool,

  // Lead scoring
  LEAD_SCORE_MODEL_VERSION: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
