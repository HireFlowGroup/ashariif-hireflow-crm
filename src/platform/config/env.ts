import "server-only";

import {
  serverEnvSchema,
  type ServerEnv,
} from "@/platform/config/env.schema";
import { getOpenAiApiKey } from "@/features/lead-intelligence/providers/manager/provider-env";
import { resetPublicEnvCacheForTests } from "@/platform/config/public-env";

export { getPublicEnv } from "@/platform/config/public-env";
export type { PublicEnv } from "@/platform/config/env.schema";
export type { ServerEnv } from "@/platform/config/env.schema";

let cachedServer: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServer) return cachedServer;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.message}`);
  }

  cachedServer = parsed.data;
  return cachedServer;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(getOpenAiApiKey()?.trim() || process.env.OPENAI_API_KEY?.trim());
}

export function resetEnvCacheForTests(): void {
  resetPublicEnvCacheForTests();
  cachedServer = null;
}
