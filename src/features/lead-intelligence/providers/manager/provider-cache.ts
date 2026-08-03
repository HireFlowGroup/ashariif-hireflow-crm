type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = parseInt(process.env.PROVIDER_CACHE_TTL_MS ?? "300000", 10);

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function buildCacheKey(providerId: string, input: string): string {
  return `${providerId}:${input.trim().toLowerCase()}`;
}

export function clearProviderCache(providerId?: string): void {
  if (!providerId) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(`${providerId}:`)) {
      cache.delete(key);
    }
  }
}
