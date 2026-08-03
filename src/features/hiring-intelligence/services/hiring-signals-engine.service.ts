import type { Company } from "@/features/companies/domain";
import type { CompaniesService, CompaniesServiceContext } from "@/features/companies/services/companies.service";
import type {
  CollectSignalsContext,
  CollectSignalsCriteria,
  IncomingHiringSignal,
} from "@/features/hiring-intelligence/domain/signal-types";
import type { HiringSignalsRepository } from "@/features/hiring-intelligence/repositories/hiring-signals.repository";
import {
  getSignalProviders,
  getSkippedSignalProviders,
} from "@/features/hiring-intelligence/providers/registry";
import {
  buildCreateCompanyFromSignal,
  matchSignalToCompany,
} from "@/features/hiring-intelligence/services/signal-company-resolver";
import {
  computeSignalFingerprint,
  mergeIncomingSignals,
} from "@/features/hiring-intelligence/services/signal-fingerprint";
import { enrichIncomingSignal } from "@/features/hiring-intelligence/services/signal-scoring";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import { createEmptyCandidate } from "@/features/lead-intelligence/providers/types";
import { normalizeCompanyName } from "@/features/lead-intelligence/services/recruitment-normalize";
import { runWithConcurrencySettled } from "@/lib/async/run-with-concurrency-settled";
import { logPipelinePhase } from "@/lib/company-finder/pipeline-logger";
import type { HiringSignal } from "@/types/hiring-intelligence";

export type ProviderCollectionReport = {
  providerId: string;
  displayName: string;
  durationMs: number;
  resultCount: number;
  success: boolean;
  error?: string;
  retryCount: number;
  fallbackProvider: string | null;
};

export type CollectAndIngestResult = {
  signalsCollected: number;
  signalsCreated: number;
  signalsUpdated: number;
  companiesResolved: number;
  candidates: ExternalCompanyCandidate[];
  providerErrors: Array<{ provider: string; message: string }>;
  providerRuns: ProviderCollectionReport[];
};

export class HiringSignalsEngine {
  constructor(
    private readonly repository: HiringSignalsRepository,
    private readonly companiesService: CompaniesService,
  ) {}

  async collectAndIngest(
    criteria: CollectSignalsCriteria,
    context: CollectSignalsContext,
  ): Promise<CollectAndIngestResult> {
    const started = Date.now();
    const activeProviders = getSignalProviders().filter(
      (provider) =>
        !criteria.providerIds?.length || criteria.providerIds.includes(provider.id),
    );
    const providerErrors: Array<{ provider: string; message: string }> = [];
    const providerRuns: ProviderCollectionReport[] = [];
    const rawSignals: IncomingHiringSignal[] = [];
    const providerConcurrency = context.providerConcurrency ?? 4;

    pipelineDebug("signals.engine.collect.start", {
      providers: activeProviders.map((provider) => provider.id),
      providerConcurrency,
      criteria,
    });

    console.info("[Discovery]", {
      phase: "collect.start",
      providers: activeProviders.map((provider) => provider.id),
      providerConcurrency,
      maxResultsPerProvider: context.maxResultsPerProvider ?? context.maxResults,
    });

    const collectionResults = await runWithConcurrencySettled(
      activeProviders.map((provider) => async () => {
        const providerStarted = Date.now();
        logPipelinePhase({
          phase: "DISCOVERY",
          provider: provider.id,
          status: "started",
          jobId: context.jobId ?? undefined,
        });

        try {
          const batch = await provider.collectSignals(criteria, context);
          const report: ProviderCollectionReport = {
            providerId: provider.id,
            displayName: provider.displayName,
            durationMs: Date.now() - providerStarted,
            resultCount: batch.length,
            success: true,
            retryCount: 0,
            fallbackProvider: null,
          };
          pipelineDebug("signals.provider.completed", {
            provider: provider.id,
            count: batch.length,
            durationMs: report.durationMs,
          });
          logPipelinePhase({
            phase: "DISCOVERY",
            provider: provider.id,
            status: "completed",
            durationMs: report.durationMs,
            resultCount: batch.length,
            jobId: context.jobId ?? undefined,
          });
          return { report, batch, error: null as string | null };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Onbekende fout";
          const report: ProviderCollectionReport = {
            providerId: provider.id,
            displayName: provider.displayName,
            durationMs: Date.now() - providerStarted,
            resultCount: 0,
            success: false,
            error: message,
            retryCount: 0,
            fallbackProvider: null,
          };
          pipelineWarn("signals.provider.failed", { provider: provider.id, message });
          logPipelinePhase({
            phase: "DISCOVERY",
            provider: provider.id,
            status: "failed",
            durationMs: report.durationMs,
            error,
            jobId: context.jobId ?? undefined,
          });
          return { report, batch: [] as IncomingHiringSignal[], error: message };
        }
      }),
      providerConcurrency,
    );

    for (const result of collectionResults) {
      if (result.status === "rejected") {
        const message = result.reason instanceof Error ? result.reason.message : "Onbekende fout";
        providerErrors.push({ provider: "unknown", message });
        continue;
      }

      providerRuns.push(result.value.report);
      rawSignals.push(...result.value.batch);
      if (result.value.error) {
        providerErrors.push({ provider: result.value.report.providerId, message: result.value.error });
      }
    }

    console.info("[Discovery]", {
      phase: "collect.completed",
      durationMs: Date.now() - started,
      providerRuns: providerRuns.map((run) => ({
        id: run.providerId,
        durationMs: run.durationMs,
        resultCount: run.resultCount,
        success: run.success,
      })),
    });

    for (const skipped of getSkippedSignalProviders()) {
      pipelineDebug("signals.provider.skipped", skipped);
    }

    const merged = mergeIncomingSignals(
      rawSignals.map((signal) => enrichIncomingSignal(signal, criteria)),
    ).filter(
      (signal) =>
        !criteria.hiringSignalTypes?.length
        || criteria.hiringSignalTypes.includes(signal.type),
    );

    let signalsCreated = 0;
    let signalsUpdated = 0;
    const ingestedSignals: HiringSignal[] = [];

    const { companies: existingCompanies } = await this.companiesService.listCompanies(
      { organizationId: context.organizationId, userId: context.userId },
      { limit: 500, includeArchived: true },
    );

    const companyPool = [...existingCompanies];
    const ingestStarted = Date.now();
    const ingestConcurrency = context.ingestConcurrency ?? 6;

    const ingestResults = await runWithConcurrencySettled(
      merged.map((signal) => async () => {
        const company = await this.resolveCompanyForSignal(
          signal,
          companyPool,
          { organizationId: context.organizationId, userId: context.userId },
        );

        const fingerprint = computeSignalFingerprint(context.organizationId, signal);

        return this.repository.upsert({
          organizationId: context.organizationId,
          jobId: context.jobId ?? undefined,
          signal: { ...signal, companyId: company?.id ?? null },
          fingerprint,
          companyId: company?.id ?? null,
        });
      }),
      ingestConcurrency,
    );

    for (const result of ingestResults) {
      if (result.status === "rejected") {
        pipelineWarn("signals.ingest.failed", {
          message: result.reason instanceof Error ? result.reason.message : "Onbekende fout",
        });
        continue;
      }

      if (result.value.created) signalsCreated += 1;
      else signalsUpdated += 1;
      ingestedSignals.push(result.value.signal);
    }

    console.info("[Discovery]", {
      phase: "ingest.completed",
      durationMs: Date.now() - ingestStarted,
      signals: merged.length,
    });

    const candidates = this.signalsToCandidates(ingestedSignals, companyPool, criteria);

    pipelineDebug("signals.engine.collect.completed", {
      collected: merged.length,
      created: signalsCreated,
      updated: signalsUpdated,
      candidates: candidates.length,
      totalDurationMs: Date.now() - started,
    });

    return {
      signalsCollected: merged.length,
      signalsCreated,
      signalsUpdated,
      companiesResolved: new Set(ingestedSignals.map((signal) => signal.company_id).filter(Boolean))
        .size,
      candidates,
      providerErrors,
      providerRuns,
    };
  }

  private async resolveCompanyForSignal(
    signal: IncomingHiringSignal,
    companyPool: Company[],
    context: CompaniesServiceContext,
  ): Promise<Company | null> {
    const matched = matchSignalToCompany(signal, companyPool);
    if (matched) return matched;

    if (!signal.companyHint?.name) return null;

    const created = await this.companiesService.createCompany(
      context,
      buildCreateCompanyFromSignal(signal, context.userId),
    );

    companyPool.push(created);

    return created;
  }

  private signalsToCandidates(
    signals: HiringSignal[],
    companies: Company[],
    criteria: CollectSignalsCriteria,
  ): ExternalCompanyCandidate[] {
    const byCompany = new Map<string, HiringSignal[]>();

    for (const signal of signals) {
      if (!signal.company_id) continue;
      const list = byCompany.get(signal.company_id) ?? [];
      list.push(signal);
      byCompany.set(signal.company_id, list);
    }

    const candidates: ExternalCompanyCandidate[] = [];

    for (const [companyId, companySignals] of byCompany) {
      const company = companies.find((entry) => (entry.id as string) === companyId);
      if (!company) continue;

      const vacancySignals = companySignals.filter((signal) =>
        ["vacancy", "indeed_vacancy"].includes(signal.signal_type),
      );

      candidates.push(
        createEmptyCandidate({
          externalId: `signals:${companyId}`,
          name: company.name,
          normalizedName: normalizeCompanyName(company.name),
          website: company.website,
          domain: company.domain,
          linkedinUrl: company.linkedinUrl,
          email: company.email,
          phone: company.phone,
          city: company.city ?? criteria.city ?? null,
          region: company.region ?? criteria.region ?? null,
          province: company.province ?? criteria.region ?? null,
          sector: company.sector ?? criteria.sector ?? null,
          source: "hiring-signals",
          sourceUrl: company.sourceUrl,
          vacancyCount: vacancySignals.length,
          vacancyTitles: vacancySignals.map((signal) => signal.title ?? "").filter(Boolean),
          hiringSignals: companySignals.map((signal) => ({
            type: signal.signal_type,
            description: signal.description ?? signal.title ?? "",
            source: signal.source ?? signal.provider,
            confidence: signal.confidence ?? 0.5,
          })),
          confidence: Math.max(...companySignals.map((signal) => signal.confidence ?? 0.5)),
          aiSummary: null,
        }),
      );
    }

    return candidates;
  }
}
