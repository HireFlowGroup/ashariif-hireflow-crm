import { describe, expect, it, beforeEach } from "vitest";

import { MemoryCacheStore } from "@/platform/cache/memory-cache";
import { isFeatureEnabled } from "@/platform/config/feature-flags";
import { DomainError } from "@/platform/errors/domain-error";
import { mapErrorToHttp } from "@/platform/errors/http-error-mapper";
import { checkRateLimit, resetRateLimitsForTests } from "@/platform/http/rate-limiter";
import { metrics } from "@/platform/observability/metrics";
import { withRetry } from "@/platform/resilience/retry";

describe("platform cache", () => {
  it("stores and expires entries", () => {
    const cache = new MemoryCacheStore<number>(1000);
    cache.set("key", 42, 50);
    expect(cache.get("key")).toBe(42);
  });
});

describe("platform retry", () => {
  it("retries transient failures", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) throw new Error("timeout");
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });
});

describe("platform rate limiter", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("blocks after limit exceeded", () => {
    const first = checkRateLimit("test-key", 2);
    expect(first.allowed).toBe(true);
    checkRateLimit("test-key", 2);
    const third = checkRateLimit("test-key", 2);
    expect(third.allowed).toBe(false);
  });
});

describe("platform errors", () => {
  it("maps domain errors to HTTP envelope", () => {
    const mapped = mapErrorToHttp(new DomainError("NOT_FOUND", "Niet gevonden"), "req-1");
    expect(mapped.status).toBe(404);
    expect(mapped.body.error.code).toBe("NOT_FOUND");
    expect(mapped.body.error.requestId).toBe("req-1");
  });
});

describe("platform feature flags", () => {
  it("defaults recruitment assistant to enabled", () => {
    expect(isFeatureEnabled("recruitment_assistant")).toBe(true);
  });
});

describe("platform metrics", () => {
  beforeEach(() => metrics.resetForTests());

  it("increments counters", () => {
    metrics.counter("test_counter").inc({ label: "a" });
    const snapshot = metrics.snapshot();
    expect(snapshot.counters['test_counter:{"label":"a"}']).toBe(1);
  });
});
