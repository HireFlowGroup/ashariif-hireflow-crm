export type ProviderCategory = "search" | "crawler" | "discovery" | "ai";

export type ProviderStatusLabel = "healthy" | "degraded" | "unhealthy" | "disabled";

export type ManagedProviderDefinition = {
  id: string;
  name: string;
  category: ProviderCategory;
  /** @deprecated Use fallbackPriority */
  priority: number;
  fallbackPriority: number;
  enabled: boolean;
  apiKeyPresent: boolean;
  apiKeyEnvVars: string[];
  skipReason?: string;
  timeoutMs: number;
  maxRetries: number;
  rateLimitPerMinute: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  requiresBackend?: string[];
};

export type ProviderRuntimeStats = {
  id: string;
  requestsToday: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  retryCount: number;
  cacheHits: number;
  cacheHitRate: number;
  avgResponseMs: number;
  lastResponseMs: number | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  healthScore: number;
  status: ProviderStatusLabel;
  quotaRemaining: number | null;
  maxRetries: number;
  cacheEnabled: boolean;
};

export type ProviderHealthSnapshot = ManagedProviderDefinition & ProviderRuntimeStats;

export type ChainExecutionMeta = {
  providerId: string;
  durationMs: number;
  responseSize: number;
  fromCache: boolean;
  attempt: number;
  fallbackUsed: boolean;
  fallbacksAttempted: string[];
};

export type SearchResultItem = {
  title: string;
  url: string;
  description: string;
};

export type CrawlResult = {
  url: string;
  html: string;
  markdown: string;
  metadata: Record<string, unknown>;
};

export type ProviderTestResult = {
  providerId: string;
  success: boolean;
  durationMs: number;
  responseSize: number;
  message: string;
  error?: string;
};

export type PipelineStepName =
  | "discovery"
  | "crawler"
  | "enrichment"
  | "ai"
  | "storage"
  | "ui";

export type PipelineStepDiagnostic = {
  id: string;
  jobId: string | null;
  step: PipelineStepName;
  providerId: string | null;
  durationMs: number;
  resultCount: number;
  errorCount: number;
  responseSize: number;
  errors: string[];
  startedAt: string;
  completedAt: string;
};

export type PipelineRunDiagnostic = {
  id: string;
  jobId: string | null;
  organizationId: string | null;
  startedAt: string;
  completedAt: string | null;
  totalDurationMs: number;
  steps: PipelineStepDiagnostic[];
  status: "running" | "completed" | "failed";
};
