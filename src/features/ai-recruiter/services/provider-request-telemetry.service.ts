import type { DiscoveryProviderDebugEntry } from "@/features/company-finder/discovery/discovery-provider-failover.types";

export type ProviderRequestTelemetry = {
  searchQueriesExecuted: number;
  providerAttempts: number;
  providerSuccesses: number;
  providerSkips: number;
  providerFailures: number;
  failoverEvents: number;
  websiteFetches: number;
  enrichmentProviderCalls: number;
  /** Legacy composite index (skips + chain touches); prefer actualHttpCalls for billing. */
  totalBillableUnits: number;
  providerHttpAttempts: number;
  providerCacheHits: number;
  estimatedBillableUnits: number;
  actualHttpCalls: number;
  budgetBlocked: number;
  byProvider: Record<
    string,
    {
      attempts: number;
      successes: number;
      skips: number;
      failures: number;
      httpAttempts: number;
      cacheHits: number;
    }
  >;
};

export function createEmptyProviderRequestTelemetry(): ProviderRequestTelemetry {
  return {
    searchQueriesExecuted: 0,
    providerAttempts: 0,
    providerSuccesses: 0,
    providerSkips: 0,
    providerFailures: 0,
    failoverEvents: 0,
    websiteFetches: 0,
    enrichmentProviderCalls: 0,
    totalBillableUnits: 0,
    providerHttpAttempts: 0,
    providerCacheHits: 0,
    estimatedBillableUnits: 0,
    actualHttpCalls: 0,
    budgetBlocked: 0,
    byProvider: {},
  };
}

function bumpProvider(
  telemetry: ProviderRequestTelemetry,
  providerId: string,
  field: "attempts" | "successes" | "skips" | "failures" | "httpAttempts" | "cacheHits",
): void {
  const bucket = telemetry.byProvider[providerId] ?? {
    attempts: 0,
    successes: 0,
    skips: 0,
    failures: 0,
    httpAttempts: 0,
    cacheHits: 0,
  };
  bucket[field] += 1;
  telemetry.byProvider[providerId] = bucket;
}

function recomputeBillableTotals(telemetry: ProviderRequestTelemetry): void {
  telemetry.actualHttpCalls = telemetry.providerHttpAttempts;
  telemetry.estimatedBillableUnits =
    telemetry.providerAttempts + telemetry.websiteFetches + telemetry.enrichmentProviderCalls;
  telemetry.totalBillableUnits = telemetry.estimatedBillableUnits;
}

/** One discovery search query with failover trace. */
export function recordDiscoveryQueryTelemetry(
  telemetry: ProviderRequestTelemetry,
  providerRuns: DiscoveryProviderDebugEntry[],
): ProviderRequestTelemetry {
  const next = { ...telemetry, byProvider: { ...telemetry.byProvider } };
  next.searchQueriesExecuted += 1;

  const started = providerRuns.filter((run) => run.started || run.success || run.skipped);
  next.providerAttempts += started.length;

  let successes = 0;
  for (const run of providerRuns) {
    if (run.budgetBlocked) {
      next.budgetBlocked += 1;
    }
    if (run.cacheHit) {
      next.providerCacheHits += 1;
      bumpProvider(next, run.providerId, "cacheHits");
    }
    const httpInvoked =
      run.httpInvoked
      ?? (
        !run.skipped
        && !run.cacheHit
        && !run.budgetBlocked
        && (run.started || run.success)
      );
    if (httpInvoked) {
      next.providerHttpAttempts += 1;
      bumpProvider(next, run.providerId, "httpAttempts");
    }
    if (run.success) {
      successes += 1;
      next.providerSuccesses += 1;
      bumpProvider(next, run.providerId, "successes");
      bumpProvider(next, run.providerId, "attempts");
    } else if (run.skipped) {
      next.providerSkips += 1;
      bumpProvider(next, run.providerId, "skips");
    } else if (run.started) {
      next.providerFailures += 1;
      bumpProvider(next, run.providerId, "failures");
      bumpProvider(next, run.providerId, "attempts");
    }
  }

  if (successes === 0 && started.length > 1) {
    next.failoverEvents += 1;
  } else if (successes > 0 && started.length > 1) {
    next.failoverEvents += 1;
  }

  recomputeBillableTotals(next);

  return next;
}

export function mergeProviderRequestTelemetry(
  parts: ProviderRequestTelemetry[],
): ProviderRequestTelemetry {
  return parts.reduce((acc, part) => {
    const merged = { ...acc, byProvider: { ...acc.byProvider } };
    merged.searchQueriesExecuted += part.searchQueriesExecuted;
    merged.providerAttempts += part.providerAttempts;
    merged.providerSuccesses += part.providerSuccesses;
    merged.providerSkips += part.providerSkips;
    merged.providerFailures += part.providerFailures;
    merged.failoverEvents += part.failoverEvents;
    merged.websiteFetches += part.websiteFetches;
    merged.enrichmentProviderCalls += part.enrichmentProviderCalls;
    merged.providerHttpAttempts += part.providerHttpAttempts;
    merged.providerCacheHits += part.providerCacheHits;
    merged.budgetBlocked += part.budgetBlocked;

    for (const [providerId, stats] of Object.entries(part.byProvider)) {
      const bucket = merged.byProvider[providerId] ?? {
        attempts: 0,
        successes: 0,
        skips: 0,
        failures: 0,
        httpAttempts: 0,
        cacheHits: 0,
      };
      merged.byProvider[providerId] = {
        attempts: bucket.attempts + stats.attempts,
        successes: bucket.successes + stats.successes,
        skips: bucket.skips + stats.skips,
        failures: bucket.failures + stats.failures,
        httpAttempts: bucket.httpAttempts + (stats.httpAttempts ?? 0),
        cacheHits: bucket.cacheHits + (stats.cacheHits ?? 0),
      };
    }

    recomputeBillableTotals(merged);

    return merged;
  }, createEmptyProviderRequestTelemetry());
}

/** Derives pipeline `providerRequests` from telemetry (paid provider HTTP attempts). */
export function resolveProviderRequestsCount(telemetry: ProviderRequestTelemetry): number {
  return telemetry.actualHttpCalls || telemetry.providerHttpAttempts;
}