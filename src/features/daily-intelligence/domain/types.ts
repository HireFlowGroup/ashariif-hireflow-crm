export type IntelligenceScanRunStatus =
  | "scheduled"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type IntelligenceScanRun = {
  id: string;
  organizationId: string;
  triggeredBy: "cron" | "manual";
  status: IntelligenceScanRunStatus;
  companiesTotal: number;
  companiesProcessed: number;
  signalsCreated: number;
  signalsUpdated: number;
  notificationsCreated: number;
  errorsCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntelligenceQueueJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export type IntelligenceQueueJob = {
  id: string;
  runId: string;
  organizationId: string;
  companyId: string;
  status: IntelligenceQueueJobStatus;
  attempts: number;
  maxAttempts: number;
  lockedAt: string | null;
  lockedBy: string | null;
  scheduledAt: string;
  completedAt: string | null;
  result: Record<string, unknown>;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntelligenceNotificationType =
  | "new_vacancy"
  | "new_recruiter"
  | "new_hr_manager"
  | "new_location"
  | "website_change"
  | "news"
  | "linkedin_change"
  | "ats_detected"
  | "signal_updated"
  | "score_increased"
  | "score_decreased"
  | "priority_changed";

export type IntelligenceNotification = {
  id: string;
  organizationId: string;
  companyId: string;
  scanRunId: string | null;
  queueJobId: string | null;
  notificationType: IntelligenceNotificationType;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type CompanyRefreshResult = {
  companyId: string;
  signalsCreated: number;
  signalsUpdated: number;
  notificationsCreated: number;
  previousScore: number | null;
  newScore: number;
  previousPriority: string | null;
  newPriority: string;
  scoreChanged: boolean;
  priorityChanged: boolean;
  providerErrors: string[];
};

export type DailySchedulerResult = {
  runsCreated: number;
  jobsEnqueued: number;
  organizations: number;
};

export type QueueWorkerResult = {
  workerId: string;
  claimed: number;
  completed: number;
  failed: number;
  staleReleased: number;
  runsFinalized: number;
};
