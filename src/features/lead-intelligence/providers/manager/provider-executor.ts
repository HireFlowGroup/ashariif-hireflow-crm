import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import {
  getCached,
  setCached,
  buildCacheKey,
} from "@/features/lead-intelligence/providers/manager/provider-cache";
import { isRateLimited } from "@/features/lead-intelligence/providers/manager/provider-rate-limiter";
import {
  recordProviderCacheHit,
  recordProviderFailure,
  recordProviderRetry,
  recordProviderSuccess,
} from "@/features/lead-intelligence/providers/manager/provider-stats.store";

export type ExecutorOptions = {
  providerId: string;
  timeoutMs: number;
  maxRetries: number;
  rateLimitPerMinute: number;
  cacheKey?: string;
  useCache?: boolean;
  cacheTtlMs?: number;
};

export async function executeWithResilience<T>(
  options: ExecutorOptions,
  fn: () => Promise<{ data: T; responseSize: number; quotaRemaining?: number | null }>,
): Promise<{
  data: T;
  durationMs: number;
  responseSize: number;
  fromCache: boolean;
  attempt: number;
}> {
  const cacheLookupKey =
    options.useCache && options.cacheKey
      ? buildCacheKey(options.providerId, options.cacheKey)
      : null;

  if (cacheLookupKey) {
    const cached = getCached<T>(cacheLookupKey);
    if (cached !== null) {
      pipelineDebug("provider.cache.hit", { providerId: options.providerId });
      recordProviderCacheHit(options.providerId);
      return {
        data: cached,
        durationMs: 0,
        responseSize: 0,
        fromCache: true,
        attempt: 0,
      };
    }
  }

  if (isRateLimited(options.providerId, options.rateLimitPerMinute)) {
    throw new Error(`Rate limit bereikt voor ${options.providerId}`);
  }

  let lastError: Error | null = null;
  const started = Date.now();

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const attemptStarted = Date.now();

    try {
      if (attempt > 0) {
        recordProviderRetry(options.providerId);
        const backoffMs = Math.min(1000 * 2 ** attempt, 8000);
        pipelineDebug("provider.retry", { providerId: options.providerId, attempt, backoffMs });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout na ${options.timeoutMs}ms`)),
            options.timeoutMs,
          ),
        ),
      ]);

      const durationMs = Date.now() - attemptStarted;
      recordProviderSuccess(options.providerId, durationMs, result.quotaRemaining ?? null);

      if (cacheLookupKey) {
        setCached(cacheLookupKey, result.data, options.cacheTtlMs);
      }

      return {
        data: result.data,
        durationMs: Date.now() - started,
        responseSize: result.responseSize,
        fromCache: false,
        attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Onbekende fout");
      const durationMs = Date.now() - attemptStarted;
      recordProviderFailure(options.providerId, lastError.message, durationMs);
      pipelineWarn("provider.attempt.failed", {
        providerId: options.providerId,
        attempt,
        message: lastError.message,
      });
    }
  }

  throw lastError ?? new Error(`Provider ${options.providerId} mislukt`);
}
