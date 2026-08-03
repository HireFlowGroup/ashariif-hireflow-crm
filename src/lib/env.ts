/** @deprecated Import from `@/platform/config/env` or `@/platform/config/public-env` for client code. */
export {
  getPublicEnv,
  getServerEnv,
  isOpenAIConfigured,
  resetEnvCacheForTests,
} from "@/platform/config/env";
export { getPublicEnv as getPublicEnvClientSafe } from "@/platform/config/public-env";
export type { PublicEnv, ServerEnv } from "@/platform/config/env.schema";
