import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  IntelligenceQueueJob,
  IntelligenceScanRun,
} from "@/features/daily-intelligence/domain/types";
import {
  IntelligenceScanRepositoryError,
  type CompleteQueueJobInput,
  type CreateScanRunInput,
  type EnqueueCompanyJobInput,
  type IntelligenceScanRepository,
  type OrganizationScanTarget,
  type UpdateScanRunStatsInput,
} from "@/features/daily-intelligence/repositories/intelligence-scan.repository";
import type { Database } from "@/types/database";

type ScanRunRow = {
  id: string;
  organization_id: string;
  triggered_by: string;
  status: string;
  companies_total: number;
  companies_processed: number;
  signals_created: number;
  signals_updated: number;
  notifications_created: number;
  errors_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type QueueJobRow = {
  id: string;
  run_id: string;
  organization_id: string;
  company_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  scheduled_at: string;
  completed_at: string | null;
  result: Record<string, unknown> | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function mapRun(row: ScanRunRow): IntelligenceScanRun {
  return {
    id: row.id,
    organizationId: row.organization_id,
    triggeredBy: row.triggered_by as IntelligenceScanRun["triggeredBy"],
    status: row.status as IntelligenceScanRun["status"],
    companiesTotal: row.companies_total,
    companiesProcessed: row.companies_processed,
    signalsCreated: row.signals_created,
    signalsUpdated: row.signals_updated,
    notificationsCreated: row.notifications_created,
    errorsCount: row.errors_count,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJob(row: QueueJobRow): IntelligenceQueueJob {
  return {
    id: row.id,
    runId: row.run_id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    status: row.status as IntelligenceQueueJob["status"],
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    result: (row.result ?? {}) as Record<string, unknown>,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseIntelligenceScanRepository implements IntelligenceScanRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createRun(input: CreateScanRunInput): Promise<IntelligenceScanRun> {
    const { data, error } = await this.client
      .from("intelligence_scan_runs")
      .insert({
        organization_id: input.organizationId,
        triggered_by: input.triggeredBy,
        status: "scheduled",
        companies_total: input.companiesTotal,
      } as never)
      .select("*")
      .single();

    if (error || !data) {
      throw new IntelligenceScanRepositoryError("Scan run kon niet worden aangemaakt.");
    }

    return mapRun(data as ScanRunRow);
  }

  async updateRunStatus(
    runId: string,
    status: IntelligenceScanRun["status"],
    patch: Partial<
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
    > = {},
  ): Promise<void> {
    const { error } = await this.client
      .from("intelligence_scan_runs")
      .update({
        status,
        started_at: patch.startedAt,
        completed_at: patch.completedAt,
        error_message: patch.errorMessage,
        companies_processed: patch.companiesProcessed,
        signals_created: patch.signalsCreated,
        signals_updated: patch.signalsUpdated,
        notifications_created: patch.notificationsCreated,
        errors_count: patch.errorsCount,
      } as never)
      .eq("id", runId);

    if (error) {
      throw new IntelligenceScanRepositoryError("Scan run status bijwerken mislukt.");
    }
  }

  async incrementRunStats(runId: string, delta: UpdateScanRunStatsInput): Promise<void> {
    const run = await this.findRunById(runId);
    if (!run) return;

    const { error } = await this.client
      .from("intelligence_scan_runs")
      .update({
        companies_processed: run.companiesProcessed + (delta.companiesProcessed ?? 0),
        signals_created: run.signalsCreated + (delta.signalsCreated ?? 0),
        signals_updated: run.signalsUpdated + (delta.signalsUpdated ?? 0),
        notifications_created: run.notificationsCreated + (delta.notificationsCreated ?? 0),
        errors_count: run.errorsCount + (delta.errorsCount ?? 0),
      } as never)
      .eq("id", runId);

    if (error) {
      throw new IntelligenceScanRepositoryError("Scan run statistieken bijwerken mislukt.");
    }
  }

  async findActiveRunForOrganization(organizationId: string): Promise<IntelligenceScanRun | null> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const { data, error } = await this.client
      .from("intelligence_scan_runs")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["scheduled", "running"])
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new IntelligenceScanRepositoryError("Actieve scan run ophalen mislukt.");
    }

    return data ? mapRun(data as ScanRunRow) : null;
  }

  async findRunById(runId: string): Promise<IntelligenceScanRun | null> {
    const { data, error } = await this.client
      .from("intelligence_scan_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();

    if (error) {
      throw new IntelligenceScanRepositoryError("Scan run ophalen mislukt.");
    }

    return data ? mapRun(data as ScanRunRow) : null;
  }

  async listRecentRuns(organizationId: string, limit = 10): Promise<IntelligenceScanRun[]> {
    const { data, error } = await this.client
      .from("intelligence_scan_runs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new IntelligenceScanRepositoryError("Scan runs laden mislukt.");
    }

    return ((data ?? []) as ScanRunRow[]).map(mapRun);
  }

  async enqueueJobs(inputs: EnqueueCompanyJobInput[]): Promise<number> {
    if (inputs.length === 0) return 0;

    const rows = inputs.map((input) => ({
      run_id: input.runId,
      organization_id: input.organizationId,
      company_id: input.companyId,
      status: "pending",
      scheduled_at: input.scheduledAt ?? new Date().toISOString(),
      max_attempts: input.maxAttempts ?? 3,
    }));

    const { error } = await this.client.from("intelligence_scan_queue").insert(rows as never);

    if (error) {
      throw new IntelligenceScanRepositoryError("Queue jobs aanmaken mislukt.");
    }

    return rows.length;
  }

  async claimJobs(workerId: string, batchSize: number): Promise<IntelligenceQueueJob[]> {
    const { data, error } = await this.client.rpc("claim_intelligence_scan_jobs", {
      p_worker_id: workerId,
      p_batch_size: batchSize,
    });

    if (error) {
      throw new IntelligenceScanRepositoryError("Queue jobs claimen mislukt.");
    }

    return ((data ?? []) as QueueJobRow[]).map(mapJob);
  }

  async releaseStaleJobs(staleMinutes: number): Promise<number> {
    const { data, error } = await this.client.rpc("release_stale_intelligence_scan_jobs", {
      p_stale_minutes: staleMinutes,
    });

    if (error) {
      throw new IntelligenceScanRepositoryError("Verouderde jobs vrijgeven mislukt.");
    }

    return (data as number) ?? 0;
  }

  async completeJob(input: CompleteQueueJobInput): Promise<void> {
    const { error } = await this.client
      .from("intelligence_scan_queue")
      .update({
        status: input.status,
        completed_at: new Date().toISOString(),
        result: (input.result ?? {}) as never,
        last_error: input.lastError ?? null,
        locked_at: null,
        locked_by: null,
      } as never)
      .eq("id", input.jobId);

    if (error) {
      throw new IntelligenceScanRepositoryError("Queue job afronden mislukt.");
    }
  }

  async requeueJob(jobId: string, scheduledAt: string, lastError: string): Promise<void> {
    const { error } = await this.client
      .from("intelligence_scan_queue")
      .update({
        status: "pending",
        scheduled_at: scheduledAt,
        last_error: lastError,
        locked_at: null,
        locked_by: null,
      } as never)
      .eq("id", jobId);

    if (error) {
      throw new IntelligenceScanRepositoryError("Queue job opnieuw plannen mislukt.");
    }
  }

  async countPendingJobsForRun(runId: string): Promise<number> {
    const { count, error } = await this.client
      .from("intelligence_scan_queue")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId)
      .in("status", ["pending", "processing"]);

    if (error) {
      throw new IntelligenceScanRepositoryError("Pending jobs tellen mislukt.");
    }

    return count ?? 0;
  }

  async listOrganizationsWithCompanies(): Promise<OrganizationScanTarget[]> {
    const { data: companies, error } = await this.client
      .from("companies")
      .select("organization_id")
      .neq("status", "inactive");

    if (error) {
      throw new IntelligenceScanRepositoryError("Organisaties laden mislukt.");
    }

    const counts = new Map<string, number>();
    for (const row of companies ?? []) {
      const orgId = (row as { organization_id: string }).organization_id;
      counts.set(orgId, (counts.get(orgId) ?? 0) + 1);
    }

    const targets: OrganizationScanTarget[] = [];

    for (const [organizationId, companyCount] of counts) {
      const { data: profile } = await this.client
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!profile) continue;

      targets.push({
        organizationId,
        userId: (profile as { id: string }).id,
        companyCount,
      });
    }

    return targets;
  }

  async getCompanyIdsForOrganization(
    organizationId: string,
    limit: number,
    offset: number,
  ): Promise<string[]> {
    const { data, error } = await this.client
      .from("companies")
      .select("id")
      .eq("organization_id", organizationId)
      .neq("status", "inactive")
      .order("updated_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new IntelligenceScanRepositoryError("Bedrijven laden mislukt.");
    }

    return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  }
}
