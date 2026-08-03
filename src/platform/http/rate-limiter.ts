import { getServerEnv } from "@/platform/config/env";
import { isFeatureEnabled } from "@/platform/config/feature-flags";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

export function checkRateLimit(key: string, limit?: number): RateLimitResult {
  if (!isFeatureEnabled("api_rate_limiting")) {
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60_000, limit: 999 };
  }

  const max = limit ?? getServerEnv().API_RATE_LIMIT_PER_MINUTE ?? 120;
  const now = Date.now();
  const windowMs = 60_000;

  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs, limit: max };
  }

  if (bucket.count >= max) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt, limit: max };
  }

  bucket.count += 1;
  return { allowed: true, remaining: max - bucket.count, resetAt: bucket.resetAt, limit: max };
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
