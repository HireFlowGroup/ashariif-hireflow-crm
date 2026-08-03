import {
  publicEnvSchema,
  type PublicEnv,
} from "@/platform/config/env.schema";

let cachedPublic: PublicEnv | null = null;

/** Client-safe public environment (no server-only dependencies). */
export function getPublicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid public environment: ${parsed.error.message}`);
  }

  cachedPublic = parsed.data;
  return cachedPublic;
}

export function resetPublicEnvCacheForTests(): void {
  cachedPublic = null;
}
