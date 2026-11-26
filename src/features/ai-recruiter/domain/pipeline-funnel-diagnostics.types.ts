import { z } from "zod";

export const providerRequestTelemetrySchema = z.object({
  searchQueriesExecuted: z.number().int().min(0).default(0),
  providerAttempts: z.number().int().min(0).default(0),
  providerSuccesses: z.number().int().min(0).default(0),
  providerSkips: z.number().int().min(0).default(0),
  providerFailures: z.number().int().min(0).default(0),
  failoverEvents: z.number().int().min(0).default(0),
  websiteFetches: z.number().int().min(0).default(0),
  enrichmentProviderCalls: z.number().int().min(0).default(0),
  totalBillableUnits: z.number().int().min(0).default(0),
  providerHttpAttempts: z.number().int().min(0).optional().default(0),
  providerCacheHits: z.number().int().min(0).optional().default(0),
  estimatedBillableUnits: z.number().int().min(0).optional().default(0),
  actualHttpCalls: z.number().int().min(0).optional().default(0),
  budgetBlocked: z.number().int().min(0).optional().default(0),
  byProvider: z
    .record(
      z.object({
        attempts: z.number().int().min(0),
        successes: z.number().int().min(0),
        skips: z.number().int().min(0),
        failures: z.number().int().min(0),
        httpAttempts: z.number().int().min(0).optional().default(0),
        cacheHits: z.number().int().min(0).optional().default(0),
      }),
    )
    .default({}),
});

export type ProviderRequestTelemetrySnapshot = z.infer<typeof providerRequestTelemetrySchema>;

export const pipelineFunnelDiagnosticsSchema = z.object({
  searchQueries: z.number().int().min(0).default(0),
  providerRequests: z.number().int().min(0).default(0),
  searchResultsReceived: z.number().int().min(0).default(0),
  uniqueCompanies: z.number().int().min(0).default(0),
  duplicateCompanies: z.number().int().min(0).default(0),
  investigatedProspects: z.number().int().min(0).default(0),
  enrichmentAttempts: z.number().int().min(0).default(0),
  eligibleProspects: z.number().int().min(0).default(0),
  needsEvidenceProspects: z.number().int().min(0).default(0),
  rejectedProspects: z.number().int().min(0).default(0),
  savedCompanies: z.number().int().min(0).default(0),
  concepts: z.number().int().min(0).default(0),
  deferredBeyondCap: z.number().int().min(0).default(0),
  providerUsed: z.string().nullable().default(null),
  providerFailoverCount: z.number().int().min(0).default(0),
  providerTelemetry: providerRequestTelemetrySchema.nullable().optional(),
  providerDegradedMode: z
    .object({
      degraded: z.boolean(),
      primaryProvider: z.string().nullable(),
      activeFallbackProviders: z.array(z.string()).default([]),
      quotaExhaustedProviders: z.array(z.string()),
      messages: z.array(z.string()),
      budget: z
        .object({
          runId: z.string().nullable(),
          totalHttpAttempts: z.number().int().min(0),
          limits: z.object({
            perRun: z.number().int().min(0),
            perProvider: z.record(z.number().int().min(0)),
          }),
          byProvider: z.record(z.number().int().min(0)),
          cacheHits: z.number().int().min(0),
          budgetBlocked: z.number().int().min(0),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  version: z.enum(["p0-r3-v1", "p0-r31-v1"]).default("p0-r31-v1"),
});

export type PipelineFunnelDiagnostics = z.infer<typeof pipelineFunnelDiagnosticsSchema>;

export function createEmptyPipelineFunnelDiagnostics(
  partial?: Partial<PipelineFunnelDiagnostics>,
): PipelineFunnelDiagnostics {
  return pipelineFunnelDiagnosticsSchema.parse({ ...partial });
}