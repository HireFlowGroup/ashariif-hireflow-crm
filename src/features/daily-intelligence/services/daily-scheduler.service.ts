import { getDailySchedulerConfig } from "@/features/daily-intelligence/config/scheduler.config";
import type { DailySchedulerResult } from "@/features/daily-intelligence/domain/types";
import type { IntelligenceScanRepository } from "@/features/daily-intelligence/repositories/intelligence-scan.repository";
import { delay } from "@/features/daily-intelligence/services/scheduler-utils";
import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";

export class DailySchedulerService {
  private readonly config = getDailySchedulerConfig();

  constructor(private readonly scanRepository: IntelligenceScanRepository) {}

  async scheduleNightlyScans(triggeredBy: "cron" | "manual" = "cron"): Promise<DailySchedulerResult> {
    if (!this.config.enabled) {
      return { runsCreated: 0, jobsEnqueued: 0, organizations: 0 };
    }

    const targets = await this.scanRepository.listOrganizationsWithCompanies();
    let runsCreated = 0;
    let jobsEnqueued = 0;

    pipelineDebug("daily.scheduler.start", { organizations: targets.length, triggeredBy });

    for (const target of targets) {
      const activeRun = await this.scanRepository.findActiveRunForOrganization(
        target.organizationId,
      );

      if (activeRun) {
        pipelineDebug("daily.scheduler.skip", {
          organizationId: target.organizationId,
          reason: "active_run_exists",
          runId: activeRun.id,
        });
        continue;
      }

      const run = await this.scanRepository.createRun({
        organizationId: target.organizationId,
        triggeredBy,
        companiesTotal: target.companyCount,
      });

      runsCreated += 1;

      await this.scanRepository.updateRunStatus(run.id, "running", {
        startedAt: new Date().toISOString(),
      });

      let offset = 0;
      const batchSize = this.config.companiesPerBatch;
      let staggerIndex = 0;

      while (true) {
        const companyIds = await this.scanRepository.getCompanyIdsForOrganization(
          target.organizationId,
          batchSize,
          offset,
        );

        if (companyIds.length === 0) break;

        const scheduledAt = new Date(
          Date.now() + staggerIndex * this.config.delayBetweenCompaniesMs,
        ).toISOString();

        const enqueued = await this.scanRepository.enqueueJobs(
          companyIds.map((companyId) => ({
            runId: run.id,
            organizationId: target.organizationId,
            companyId,
            scheduledAt,
            maxAttempts: this.config.maxAttempts,
          })),
        );

        jobsEnqueued += enqueued;
        offset += batchSize;
        staggerIndex += 1;

        await delay(50);
      }

      pipelineDebug("daily.scheduler.org_enqueued", {
        organizationId: target.organizationId,
        runId: run.id,
        companies: target.companyCount,
      });
    }

    pipelineDebug("daily.scheduler.completed", { runsCreated, jobsEnqueued });

    return {
      runsCreated,
      jobsEnqueued,
      organizations: targets.length,
    };
  }
}
