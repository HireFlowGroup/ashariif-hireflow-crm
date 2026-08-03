import type { ProviderRuntimeStats, ProviderStatusLabel } from "@/features/lead-intelligence/providers/manager/types";

type MutableStats = {
  requestsToday: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  cacheHits: number;
  totalResponseMs: number;
  lastResponseMs: number | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  quotaRemaining: number | null;
  dayKey: string;
};

const store = new Map<string, MutableStats>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMutable(providerId: string): MutableStats {
  const dayKey = todayKey();
  const existing = store.get(providerId);

  if (!existing || existing.dayKey !== dayKey) {
    const fresh: MutableStats = {
      requestsToday: 0,
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      cacheHits: 0,
      totalResponseMs: 0,
      lastResponseMs: null,
      lastError: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      quotaRemaining: null,
      dayKey,
    };
    store.set(providerId, fresh);
    return fresh;
  }

  return existing;
}

function computeHealthScore(stats: MutableStats): number {
  const total = stats.successCount + stats.failureCount;
  if (total === 0) return 100;
  return Math.round((stats.successCount / total) * 100);
}

function computeStatus(healthScore: number, enabled: boolean): ProviderStatusLabel {
  if (!enabled) return "disabled";
  if (healthScore >= 80) return "healthy";
  if (healthScore >= 50) return "degraded";
  return "unhealthy";
}

export function recordProviderSuccess(
  providerId: string,
  durationMs: number,
  quotaRemaining: number | null = null,
): void {
  const stats = getMutable(providerId);
  stats.requestsToday += 1;
  stats.successCount += 1;
  stats.totalResponseMs += durationMs;
  stats.lastResponseMs = durationMs;
  stats.lastSuccessAt = new Date().toISOString();
  if (quotaRemaining !== null) stats.quotaRemaining = quotaRemaining;
}

export function recordProviderFailure(providerId: string, error: string, durationMs: number): void {
  const stats = getMutable(providerId);
  stats.requestsToday += 1;
  stats.failureCount += 1;
  stats.totalResponseMs += durationMs;
  stats.lastResponseMs = durationMs;
  stats.lastError = error;
  stats.lastFailureAt = new Date().toISOString();
}

export function recordProviderRetry(providerId: string): void {
  getMutable(providerId).retryCount += 1;
}

export function recordProviderCacheHit(providerId: string): void {
  const stats = getMutable(providerId);
  stats.cacheHits += 1;
  stats.requestsToday += 1;
  stats.successCount += 1;
  stats.lastSuccessAt = new Date().toISOString();
}

export function getProviderRuntimeStats(
  providerId: string,
  enabled: boolean,
  maxRetries = 0,
  cacheEnabled = true,
): ProviderRuntimeStats {
  const stats = getMutable(providerId);
  const healthScore = enabled ? computeHealthScore(stats) : 0;
  const totalAttempts = stats.successCount + stats.failureCount;
  const successRate = totalAttempts > 0 ? Math.round((stats.successCount / totalAttempts) * 100) : 100;
  const cacheHitRate =
    stats.requestsToday > 0 ? Math.round((stats.cacheHits / stats.requestsToday) * 100) : 0;

  return {
    id: providerId,
    requestsToday: stats.requestsToday,
    successCount: stats.successCount,
    failureCount: stats.failureCount,
    successRate,
    retryCount: stats.retryCount,
    cacheHits: stats.cacheHits,
    cacheHitRate,
    avgResponseMs: totalAttempts > 0 ? Math.round(stats.totalResponseMs / totalAttempts) : 0,
    lastResponseMs: stats.lastResponseMs,
    lastError: stats.lastError,
    lastSuccessAt: stats.lastSuccessAt,
    lastFailureAt: stats.lastFailureAt,
    healthScore,
    status: computeStatus(healthScore, enabled),
    quotaRemaining: stats.quotaRemaining,
    maxRetries,
    cacheEnabled,
  };
}

export function resetProviderStats(providerId?: string): void {
  if (providerId) {
    store.delete(providerId);
    return;
  }
  store.clear();
}
