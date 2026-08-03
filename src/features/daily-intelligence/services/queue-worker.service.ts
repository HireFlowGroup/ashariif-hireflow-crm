import { createCompaniesServiceFromClient } from "@/features/companies/create-companies-service";
import { toCompanyId } from "@/features/companies/domain";
import { getDailySchedulerConfig } from "@/features/daily-intelligence/config/scheduler.config";
import type { QueueWorkerResult } from "@/features/daily-intelligence/domain/types";
import type { IntelligenceScanRepository } from "@/features/daily-intelligence/repositories/intelligence-scan.repository";
import { CompanyIntelligenceRefreshService } from "@/features/daily-intelligence/services/company-intelligence-refresh.service";
import { createWorkerId, delay } from "@/features/daily-intelligence/services/scheduler-utils";
import { SupabaseHiringSignalsRepository } from "@/features/hiring-intelligence/repositories/supabase-hiring-signals.repository";
import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

import type { IntelligenceNotificationsRepository } from "../repositories/intelligence-scan.repository";

export class QueueWorkerService {
  private readonly config = getDailySchedulerConfig();

  constructor(
    private readonly scanRepository: IntelligenceScanRepository,
    private readonly notificationsRepository: IntelligenceNotificationsRepository,
    private readonly serviceClient: SupabaseClient<Database>,
  ) {}

  async processBatch(workerId = createWorkerId()): Promise<QueueWorkerResult> {
    const staleReleased = await this.scanRepository.releaseStaleJobs(
      this.config.staleJobMinutes,
    );

    const jobs = await this.scanRepository.claimJobs(workerId, this.config.workerBatchSize);

    let completed = 0;
    let failed = 0;
    const processedRunIds = new Set<string>();

    pipelineDebug("daily.worker.claimed", { workerId, count: jobs.length, staleReleased });

    for (const job of jobs) {
      processedRunIds.add(job.runId);

      try {
        const companiesService = createCompaniesServiceFromClient(this.serviceClient);
        const refreshService = new CompanyIntelligenceRefreshService(
          new SupabaseHiringSignalsRepository(this.serviceClient),
          companiesService,
          this.notificationsRepository,
          this.serviceClient,
        );

        const { data: profile } = await this.serviceClient
          .from("profiles")
          .select("id")
          .eq("organization_id", job.organizationId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const userId = (profile as { id: string } | null)?.id;
        if (!userId) {
          throw new Error("Geen gebruiker gevonden voor organisatie.");
        }

        const company = await companiesService.getCompany(
          { organizationId: job.organizationId, userId },
          toCompanyId(job.companyId),
        );

        const result = await refreshService.refreshCompany({
          company,
          organizationId: job.organizationId,
          userId,
          runId: job.runId,
          queueJobId: job.id,
        });

        await this.scanRepository.completeJob({
          jobId: job.id,
          status: "completed",
          result: result as unknown as Record<string, unknown>,
        });

        await this.scanRepository.incrementRunStats(job.runId, {
          companiesProcessed: 1,
          signalsCreated: result.signalsCreated,
          signalsUpdated: result.signalsUpdated,
          notificationsCreated: result.notificationsCreated,
        });

        completed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        pipelineWarn("daily.worker.job_failed", { jobId: job.id, message });

        if (job.attempts >= job.maxAttempts) {
          await this.scanRepository.completeJob({
            jobId: job.id,
            status: "failed",
            lastError: message,
          });
          await this.scanRepository.incrementRunStats(job.runId, {
            companiesProcessed: 1,
            errorsCount: 1,
          });
          failed += 1;
        } else {
          const retryAt = new Date(
            Date.now() + job.attempts * this.config.delayBetweenCompaniesMs * 2,
          ).toISOString();
          await this.scanRepository.requeueJob(job.id, retryAt, message);
        }
      }

      await delay(this.config.delayBetweenCompaniesMs);
    }

    let runsFinalized = 0;

    for (const runId of processedRunIds) {
      const pending = await this.scanRepository.countPendingJobsForRun(runId);
      if (pending > 0) continue;

      const run = await this.scanRepository.findRunById(runId);
      if (!run || run.status === "completed" || run.status === "failed") continue;

      await this.scanRepository.updateRunStatus(runId, "completed", {
        completedAt: new Date().toISOString(),
      });
      runsFinalized += 1;
    }

    return {
      workerId,
      claimed: jobs.length,
      completed,
      failed,
      staleReleased,
      runsFinalized,
    };
  }
}
