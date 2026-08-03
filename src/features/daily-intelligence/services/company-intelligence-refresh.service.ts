import type { Company } from "@/features/companies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import {
  CHECK_TYPE_TO_NOTIFICATION,
  getDailySchedulerConfig,
} from "@/features/daily-intelligence/config/scheduler.config";
import type { CompanyRefreshResult } from "@/features/daily-intelligence/domain/types";
import type { IntelligenceNotificationsRepository } from "@/features/daily-intelligence/repositories/intelligence-scan.repository";
import { persistCompanyScore } from "@/features/daily-intelligence/services/company-score-persistence.service";
import {
  buildCompanyHintFromCompany,
  buildCompanyRefreshCriteria,
  delay,
  isSignalRelevantToCompany,
} from "@/features/daily-intelligence/services/scheduler-utils";
import type {
  CollectSignalsContext,
  IncomingHiringSignal,
} from "@/features/hiring-intelligence/domain/signal-types";
import { getSignalTypeLabel } from "@/features/hiring-intelligence/domain/signal-types";
import {
  getSignalProviders,
  getSkippedSignalProviders,
} from "@/features/hiring-intelligence/providers/registry";
import type { HiringSignalsRepository } from "@/features/hiring-intelligence/repositories/hiring-signals.repository";
import { computeSignalFingerprint, mergeIncomingSignals } from "@/features/hiring-intelligence/services/signal-fingerprint";
import { enrichIncomingSignal } from "@/features/hiring-intelligence/services/signal-scoring";
import { triggerCompanyAnalysisRefresh } from "@/features/company-ai-analysis/trigger-company-analysis";
import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { HiringSignal } from "@/types/hiring-intelligence";

export type RefreshCompanyParams = {
  company: Company;
  organizationId: string;
  userId: string;
  runId?: string;
  queueJobId?: string;
};

export class CompanyIntelligenceRefreshService {
  private readonly config = getDailySchedulerConfig();

  constructor(
    private readonly signalsRepository: HiringSignalsRepository,
    private readonly companiesService: CompaniesService,
    private readonly notificationsRepository: IntelligenceNotificationsRepository,
    private readonly serviceClient: SupabaseClient<Database>,
  ) {}

  async refreshCompany(params: RefreshCompanyParams): Promise<CompanyRefreshResult> {
    const { company, organizationId, userId, runId, queueJobId } = params;
    const criteria = buildCompanyRefreshCriteria(company);
    const context: CollectSignalsContext = {
      organizationId,
      userId,
      jobId: runId ?? null,
      timeoutMs: parseInt(process.env.COMPANY_FINDER_PROVIDER_TIMEOUT_MS ?? "20000", 10),
      maxResults: 8,
    };

    const previousScore = company.leadScore;
    const previousPriority = company.leadPriority;
    const providerErrors: string[] = [];
    const rawSignals: IncomingHiringSignal[] = [];

    pipelineDebug("daily.refresh.start", { companyId: company.id, name: company.name });

    for (const provider of getSignalProviders()) {
      try {
        await delay(this.config.delayBetweenChecksMs);
        const batch = await provider.collectSignals(criteria, context);
        rawSignals.push(...batch);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        providerErrors.push(`${provider.id}: ${message}`);
        pipelineWarn("daily.provider.failed", { provider: provider.id, message });
      }
    }

    for (const skipped of getSkippedSignalProviders()) {
      pipelineDebug("daily.provider.skipped", skipped);
    }

    const companyHint = buildCompanyHintFromCompany(company);
    const scopedSignals = rawSignals
      .filter((signal) => isSignalRelevantToCompany(signal, company))
      .map((signal) => ({
        ...signal,
        companyId: company.id as string,
        companyHint,
      }));

    const merged = mergeIncomingSignals(
      scopedSignals.map((signal) => enrichIncomingSignal(signal, criteria)),
    );

    let signalsCreated = 0;
    let signalsUpdated = 0;
    const createdSignals: HiringSignal[] = [];

    for (const signal of merged) {
      const fingerprint = computeSignalFingerprint(organizationId, signal);

      const result = await this.signalsRepository.upsert({
        organizationId,
        jobId: runId ?? null,
        signal: { ...signal, companyId: company.id as string },
        fingerprint,
        companyId: company.id as string,
      });

      if (result.created) {
        signalsCreated += 1;
        createdSignals.push(result.signal);
      } else {
        signalsUpdated += 1;
      }
    }

    const allSignals = await this.signalsRepository.findByCompany(
      organizationId,
      company.id as string,
    );

    const { data: contactRows } = await this.serviceClient
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", company.id as string);

    const scoreResult = await persistCompanyScore(
      this.serviceClient,
      organizationId,
      company,
      allSignals,
      contactRows ?? [],
    );

    const notificationsCreated = await this.createChangeNotifications({
      organizationId,
      company,
      runId,
      queueJobId,
      createdSignals,
      previousScore,
      previousPriority,
      newScore: scoreResult.score,
      newPriority: scoreResult.priority,
    });

    pipelineDebug("daily.refresh.completed", {
      companyId: company.id,
      signalsCreated,
      signalsUpdated,
      notificationsCreated,
      score: scoreResult.score,
    });

    if (signalsCreated > 0 || signalsUpdated > 0 || previousScore !== scoreResult.score) {
      void triggerCompanyAnalysisRefresh({
        organizationId,
        userId,
        companyId: company.id as string,
      });
    }

    return {
      companyId: company.id as string,
      signalsCreated,
      signalsUpdated,
      notificationsCreated,
      previousScore,
      newScore: scoreResult.score,
      previousPriority,
      newPriority: scoreResult.priority,
      scoreChanged: previousScore !== scoreResult.score,
      priorityChanged: previousPriority !== scoreResult.priority,
      providerErrors,
    };
  }

  private async createChangeNotifications(params: {
    organizationId: string;
    company: Company;
    runId?: string;
    queueJobId?: string;
    createdSignals: HiringSignal[];
    previousScore: number | null;
    previousPriority: string | null;
    newScore: number;
    newPriority: string;
  }): Promise<number> {
    const notifications: Parameters<IntelligenceNotificationsRepository["createBatch"]>[0] = [];

    if (this.config.notifyOnSignalCreate) {
      for (const signal of params.createdSignals) {
        const notificationType =
          (CHECK_TYPE_TO_NOTIFICATION[signal.signal_type] as
            | import("@/features/daily-intelligence/domain/types").IntelligenceNotificationType
            | undefined) ?? "signal_updated";

        notifications.push({
          organizationId: params.organizationId,
          companyId: params.company.id as string,
          scanRunId: params.runId ?? null,
          queueJobId: params.queueJobId ?? null,
          notificationType,
          title: `${getSignalTypeLabel(signal.signal_type)} — ${params.company.name}`,
          message: signal.title ?? signal.description ?? "Nieuw hiring signaal gedetecteerd.",
          payload: {
            signalId: signal.id,
            signalType: signal.signal_type,
            sourceUrl: signal.source_url,
          },
        });
      }
    }

    if (this.config.notifyOnScoreChange) {
      const scoreDelta =
        params.previousScore === null
          ? params.newScore
          : Math.abs(params.newScore - params.previousScore);

      if (
        params.previousPriority !== null &&
        params.previousPriority !== params.newPriority
      ) {
        notifications.push({
          organizationId: params.organizationId,
          companyId: params.company.id as string,
          scanRunId: params.runId ?? null,
          queueJobId: params.queueJobId ?? null,
          notificationType: "priority_changed",
          title: `Prioriteit gewijzigd — ${params.company.name}`,
          message: `Lead prioriteit: ${params.previousPriority} → ${params.newPriority} (score ${params.newScore}).`,
          payload: {
            previousPriority: params.previousPriority,
            newPriority: params.newPriority,
            score: params.newScore,
          },
        });
      } else if (
        params.previousScore !== null &&
        scoreDelta >= this.config.scoreChangeThreshold
      ) {
        notifications.push({
          organizationId: params.organizationId,
          companyId: params.company.id as string,
          scanRunId: params.runId ?? null,
          queueJobId: params.queueJobId ?? null,
          notificationType:
            params.newScore > params.previousScore ? "score_increased" : "score_decreased",
          title: `Leadscore gewijzigd — ${params.company.name}`,
          message: `Score: ${params.previousScore} → ${params.newScore} (prioriteit ${params.newPriority}).`,
          payload: {
            previousScore: params.previousScore,
            newScore: params.newScore,
            priority: params.newPriority,
          },
        });
      }
    }

    if (notifications.length === 0) return 0;

    const created = await this.notificationsRepository.createBatch(notifications);
    return created.length;
  }
}
