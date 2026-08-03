import { getServerEnv } from "@/platform/config/env";
import { MemoryCacheStore } from "@/platform/cache/memory-cache";

let platformCache: MemoryCacheStore | null = null;

export function getPlatformCache(): MemoryCacheStore {
  if (!platformCache) {
    const ttl = getServerEnv().PLATFORM_CACHE_TTL_MS ?? 300_000;
    platformCache = new MemoryCacheStore(ttl);
  }
  return platformCache;
}

export function resetPlatformCacheForTests(): void {
  platformCache?.clear();
  platformCache = null;
}
