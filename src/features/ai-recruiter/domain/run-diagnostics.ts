import { z } from "zod";

export const runFailureCodeSchema = z.enum([
  "provider_not_configured",
  "provider_auth_failed",
  "provider_rate_limited",
  "provider_timeout",
  "provider_request_failed",
  "no_results",
  "no_valid_companies",
  "database_error",
  "unknown_error",
]);

export type RunFailureCode = z.infer<typeof runFailureCodeSchema>;

export const runDiagnosticsSchema = z.object({
  errorCode: runFailureCodeSchema.nullable(),
  errorMessage: z.string().nullable(),
  providerName: z.string().nullable(),
  providerActive: z.boolean().nullable(),
  requestCriteria: z.record(z.unknown()).default({}),
  httpStatus: z.number().int().nullable(),
  responseCount: z.number().int().min(0).default(0),
  normalizedCount: z.number().int().min(0).default(0),
  rejectedCount: z.number().int().min(0).default(0),
  rejectionReasons: z.array(z.string()).default([]),
  durationMs: z.number().int().nullable(),
  retryRecommended: z.boolean().default(false),
  timestamp: z.string(),
});

export type RunDiagnostics = z.infer<typeof runDiagnosticsSchema>;

export type RunFailureUiMessage = {
  title: string;
  body: string;
  retryRecommended: boolean;
  showProviderSettings: boolean;
  providerName: string | null;
};

export function createEmptyRunDiagnostics(
  requestCriteria: Record<string, unknown> = {},
): RunDiagnostics {
  return runDiagnosticsSchema.parse({
    errorCode: null,
    errorMessage: null,
    providerName: null,
    providerActive: null,
    requestCriteria,
    httpStatus: null,
    responseCount: 0,
    normalizedCount: 0,
    rejectedCount: 0,
    rejectionReasons: [],
    durationMs: null,
    retryRecommended: false,
    timestamp: new Date().toISOString(),
  });
}
