import type {
  IntelligenceNotification,
  IntelligenceNotificationType,
  IntelligenceQueueJob,
  IntelligenceScanRun,
} from "@/features/daily-intelligence/domain/types";

export type CreateScanRunInput = {
  organizationId: string;
  triggeredBy: "cron" | "manual";
  companiesTotal: number;
};

export type EnqueueCompanyJobInput = {
  runId: string;
  organizationId: string;
  companyId: string;
  scheduledAt?: string;
  maxAttempts?: number;
};

export type UpdateScanRunStatsInput = {
  companiesProcessed?: number;
  signalsCreated?: number;
  signalsUpdated?: number;
  notificationsCreated?: number;
  errorsCount?: number;
};

export type CompleteQueueJobInput = {
  jobId: string;
  status: "completed" | "failed" | "skipped";
  result?: Record<string, unknown>;
  lastError?: string | null;
};

export type OrganizationScanTarget = {
  organizationId: string;
  userId: string;
  companyCount: number;
};

export interface IntelligenceScanRepository {
  createRun(input: CreateScanRunInput): Promise<IntelligenceScanRun>;
  updateRunStatus(
    runId: string,
    status: IntelligenceScanRun["status"],
    patch?: Partial<
      Pick<
        IntelligenceScanRun,
        | "startedAt"
        | "completedAt"
        | "errorMessage"
        | "companiesProcessed"
        | "signalsCreated"
        | "signalsUpdated"
        | "notificationsCreated"
        | "errorsCount"
      >
    >,
  ): Promise<void>;
  incrementRunStats(runId: string, delta: UpdateScanRunStatsInput): Promise<void>;
  findActiveRunForOrganization(organizationId: string): Promise<IntelligenceScanRun | null>;
  findRunById(runId: string): Promise<IntelligenceScanRun | null>;
  listRecentRuns(organizationId: string, limit?: number): Promise<IntelligenceScanRun[]>;
  enqueueJobs(inputs: EnqueueCompanyJobInput[]): Promise<number>;
  claimJobs(workerId: string, batchSize: number): Promise<IntelligenceQueueJob[]>;
  releaseStaleJobs(staleMinutes: number): Promise<number>;
  completeJob(input: CompleteQueueJobInput): Promise<void>;
  requeueJob(jobId: string, scheduledAt: string, lastError: string): Promise<void>;
  countPendingJobsForRun(runId: string): Promise<number>;
  listOrganizationsWithCompanies(): Promise<OrganizationScanTarget[]>;
  getCompanyIdsForOrganization(
    organizationId: string,
    limit: number,
    offset: number,
  ): Promise<string[]>;
}

export type CreateNotificationInput = {
  organizationId: string;
  companyId: string;
  scanRunId?: string | null;
  queueJobId?: string | null;
  notificationType: IntelligenceNotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
};

export interface IntelligenceNotificationsRepository {
  create(input: CreateNotificationInput): Promise<IntelligenceNotification>;
  createBatch(inputs: CreateNotificationInput[]): Promise<IntelligenceNotification[]>;
  listUnread(organizationId: string, limit?: number): Promise<IntelligenceNotification[]>;
  listRecent(organizationId: string, limit?: number): Promise<IntelligenceNotification[]>;
  markRead(organizationId: string, notificationIds: string[]): Promise<number>;
  countUnread(organizationId: string): Promise<number>;
}

export class IntelligenceScanRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntelligenceScanRepositoryError";
  }
}

export class IntelligenceNotificationsRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntelligenceNotificationsRepositoryError";
  }
}
