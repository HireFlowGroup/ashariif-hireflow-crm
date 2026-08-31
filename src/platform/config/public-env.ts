import {
  publicEnvSchema,
  type PublicEnv,
} from "@/platform/config/env.schema";

let cachedPublic: PublicEnv | null = null;

/**
 * Resolve Supabase anon/publishable key.
 * Accepts NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as alias (Make-HireFlow Vercel naming).
 */
export function resolveSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || undefined
  );
}

/** Client-safe public environment (no server-only dependencies). */
export function getPublicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveSupabaseAnonKey(),
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
