import "server-only";

import type { CreateCompanyInput, UpdateCompanyInput, Company } from "@/features/companies/domain";
import type { CompaniesService, CompaniesServiceContext } from "@/features/companies/services/companies.service";
import { mergeLeadFields } from "@/features/companies/repositories/company.mapper";
import type {
  CompanyFinderCriteria,
  CompanyFinderProgress,
  CompanySearchJob,
  ExternalCompanyCandidate,
} from "@/features/company-finder/domain";
import { toFinderProviderId } from "@/features/company-finder/domain";
import type { CompanySearchJobRepository } from "@/features/company-finder/repositories";
import { CompanyFinderServiceError } from "@/features/company-finder/services/errors";
import { PipelineRunTracker } from "@/features/company-finder/pipeline/pipeline-run-tracker";
import type { PipelineStreamEvent } from "@/features/company-finder/pipeline/pipeline-viewer.types";
import { createCompanySearchJobSchema } from "@/features/company-finder/validation";
import { getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";
import type {
  CompanySearchCriteria,
  ExternalCompanyCandidate as LeadCandidate,
} from "@/features/lead-intelligence/domain";
import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import { createHiringSignalsEngine } from "@/features/hiring-intelligence/create-hiring-signals-engine";
import { triggerCompanyAnalysisRefresh } from "@/features/company-ai-analysis/trigger-company-analysis";
import {
  completePipelineRun,
  completePipelineStep,
  getProviderManager,
  getSearchProviderAvailability,
  hasAnySearchProvider,
  startPipelineRun,
  startPipelineStep,
} from "@/features/lead-intelligence/providers/manager";
import { classifyAndSummarizeLead } from "@/features/lead-intelligence/services/ai-classifier.service";
import { enrichRecruitmentCandidate } from "@/features/lead-intelligence/services/recruitment-enrichment.service";
import { createProviderVaultService } from "@/features/provider-vault/server";
import { enterOrganizationContext } from "@/features/provider-vault/server";
import { createClient } from "@/lib/supabase/server";
import {
  dedupeCandidates,
  isExcludedCandidate,
  matchAgainstExisting,
} from "@/features/lead-intelligence/services/dedupe";
import { employeeRangeToMinMax, extractDomain } from "@/features/lead-intelligence/services/normalize";
import { scoreLeadWithExplanation } from "@/features/lead-scoring/services/lead-scoring.service";
import { runWithConcurrencySettled } from "@/lib/async/run-with-concurrency-settled";
import {
  JobDeadline,
  JobTimeoutError,
  PipelineStepTimer,
} from "@/features/company-finder/pipeline/pipeline-step-timer";
import { runFastCompanyFinderPipeline } from "@/features/company-finder/services/fast-company-finder.pipeline";
import { buildDiscoveryCreateInput } from "@/features/company-finder/services/discovery-save";
import { withTimeout } from "@/features/lead-intelligence/config/providers.config";
import { logPipelinePhase } from "@/lib/company-finder/pipeline-logger";
import { sanitizeDiscoveryUrl } from "@/lib/company-finder/sanitize-discovery-url";

export type LeadIntelligenceContext = CompaniesServiceContext;

export type LeadIntelligenceRunEvent =
  | { type: "progress"; progress: CompanyFinderProgress }
  | { type: "event"; eventType: string; payload: Record<string, unknown> }
  | { type: "candidate"; candidate: ExternalCompanyCandidate; saved: boolean; updated: boolean; skipped: boolean }
  | { type: "pipeline"; event: PipelineStreamEvent }
  | { type: "complete"; job: CompanySearchJob }
  | { type: "error"; message: string };

function criteriaToSearchCriteria(criteria: CompanyFinderCriteria): CompanySearchCriteria {
  const { min, max } = employeeRangeToMinMax(criteria.employeeCountRange);

  return {
    city: criteria.city,
    region: criteria.region,
    sector: criteria.sector,
    keywords: criteria.keywords,
    employeeCountMin: criteria.employeeCountMin ?? min ?? undefined,
    employeeCountMax: criteria.employeeCountMax ?? max ?? undefined,
    employeeCountRange: criteria.employeeCountRange,
    vacancyTitles: criteria.vacancyTitles,
    hiringSignalTypes: criteria.hiringSignalTypes,
    providerIds: criteria.providerIds,
    searchVacancies: criteria.searchVacancies ?? true,
    maxResults: criteria.maxResults,
    excludedNames: criteria.excludedNames,
    excludedSectors: criteria.excludedSectors,
  };
}

function toLegacyCandidate(candidate: LeadCandidate): ExternalCompanyCandidate {
  return {
    name: candidate.name,
    city: candidate.city,
    sector: candidate.sector,
    website: candidate.website,
    employeeCountRange: null,
    sourceProviderId: toFinderProviderId(candidate.source),
    externalId: candidate.externalId,
    sourceUrl: candidate.sourceUrl,
    leadScore: null,
    leadPriority: null,
    vacancyCount: candidate.vacancyCount,
  };
}

function candidateToCreateInput(
  candidate: LeadCandidate,
  score: Awaited<ReturnType<typeof scoreLeadWithExplanation>>,
  aiSummary: string,
  userId: string,
): CreateCompanyInput {
  return {
    name: candidate.name,
    ownerId: userId,
    website: sanitizeDiscoveryUrl(candidate.website),
    domain: candidate.domain ?? extractDomain(sanitizeDiscoveryUrl(candidate.website)),
    linkedinUrl: sanitizeDiscoveryUrl(candidate.linkedinUrl),
    email: candidate.generalEmail ?? candidate.hrEmail ?? candidate.email,
    generalEmail: candidate.generalEmail,
    hrEmail: candidate.hrEmail,
    phone: candidate.phone,
    sector: candidate.sector,
    city: candidate.city,
    region: candidate.region,
    province: candidate.province ?? candidate.region,
    country: candidate.country ?? "NL",
    employeeCountMin: candidate.employeeCountMin,
    employeeCountMax: candidate.employeeCountMax,
    employeeCountLabel: candidate.employeeCountLabel,
    careersUrl: sanitizeDiscoveryUrl(candidate.careersUrl),
    vacancyPageUrl: sanitizeDiscoveryUrl(candidate.vacancyPageUrl),
    kvkNumber: candidate.kvkNumber,
    aiSummary,
    leadScore: score.score,
    leadPriority: score.priority,
    scoreReason: score.explanation ?? score.scoreReason,
    scoreBreakdown: score.components,
    vacancyCount: candidate.vacancyCount,
    hiringSignals: candidate.hiringSignals,
    source: candidate.source ?? "tavily",
    sourceUrl: sanitizeDiscoveryUrl(candidate.sourceUrl),
    confidence: candidate.confidence,
    lastVerifiedAt: candidate.lastVerifiedAt ?? new Date().toISOString(),
    status: "prospect",
    notes: aiSummary,
  };
}

function progressPercent(phase: CompanyFinderProgress["phase"], step = 0, total = 1): number {
  const map: Record<string, number> = {
    queued: 2,
    pending: 5,
    running: 8,
    searching: 20,
    enriching: 45,
    deduplicating: 65,
    scoring: 75,
    saving: 88,
    completed: 100,
    partially_completed: 100,
    failed: 100,
    cancelled: 100,
  };

  const base = map[phase] ?? 10;

  if (phase === "searching" && total > 0) {
    return base + Math.round((25 / total) * (step + 1));
  }

  return base;
}

const DEDUPE_PAGE_SIZE = 100;

async function loadExistingCompaniesForDedupe(
  companiesService: CompaniesService,
  context: LeadIntelligenceContext,
): Promise<Company[]> {
  const existingCompanies: Company[] = [];
  let offset = 0;

  while (true) {
    const { companies } = await companiesService.listCompanies(context, {
      limit: DEDUPE_PAGE_SIZE,
      offset,
      includeArchived: true,
    });

    existingCompanies.push(...companies);

    if (companies.length < DEDUPE_PAGE_SIZE) {
      break;
    }

    offset += DEDUPE_PAGE_SIZE;
  }

  return existingCompanies;
}

export class LeadIntelligenceEngine {
  constructor(
    private readonly jobRepository: CompanySearchJobRepository,
    private readonly companiesService: CompaniesService,
  ) {}

  async createJob(
    context: LeadIntelligenceContext,
    criteria: CompanyFinderCriteria,
  ): Promise<CompanySearchJob> {
    const parsed = createCompanySearchJobSchema.safeParse(criteria);

    if (!parsed.success) {
      throw new CompanyFinderServiceError(
        parsed.error.issues[0]?.message ?? "Ongeldige zoekcriteria.",
      );
    }

    pipelineDebug("job.create.start", {
      organizationId: context.organizationId,
      userId: context.userId,
      criteria: parsed.data,
    });

    const job = await this.jobRepository.create({
      organizationId: context.organizationId,
      userId: context.userId,
      criteria: parsed.data,
    });

    pipelineDebug("job.create.completed", { jobId: job.id, status: job.status });

    return job;
  }

  async getJob(context: LeadIntelligenceContext, jobId: string): Promise<CompanySearchJob> {
    const job = await this.jobRepository.findById(context.organizationId, jobId);

    if (!job) {
      throw new CompanyFinderServiceError("Zoekjob niet gevonden.");
    }

    if (job.userId !== context.userId) {
      throw new CompanyFinderServiceError("Geen toegang tot deze zoekjob.");
    }

    return job;
  }

  async *runJob(
    context: LeadIntelligenceContext,
    jobId: string,
  ): AsyncGenerator<LeadIntelligenceRunEvent> {
    const config = getLeadIntelligenceConfig();
    const stepTimer = new PipelineStepTimer(jobId);
    const deadline = JobDeadline.fromTimeoutMs(config.globalJobTimeoutMs);
    const job = await this.jobRepository.findById(context.organizationId, jobId);

    if (!job) {
      yield { type: "error", message: "Zoekjob niet gevonden." };
      return;
    }

    if (job.userId !== context.userId) {
      yield { type: "error", message: "Geen toegang tot deze zoekjob." };
      return;
    }

    let currentJob = job;

    const supabase = await createClient();
    await createProviderVaultService(supabase).warmOrganizationCache(context.organizationId);
    enterOrganizationContext(context.organizationId);

    if (job.status === "completed" || job.status === "partially_completed") {
      yield { type: "complete", job };
      return;
    }

    if (["running", "searching", "enriching", "scoring", "saving"].includes(job.status)) {
      const staleMs = Date.now() - Date.parse(job.updatedAt);
      if (staleMs < 90_000) {
        yield { type: "error", message: "Deze zoekjob wordt al uitgevoerd." };
        return;
      }

      pipelineWarn("job.run.stale_recovery", { jobId, status: job.status, staleMs });
      currentJob = await this.jobRepository.update(context.organizationId, jobId, {
        status: "queued",
        errorMessage: null,
      });
    }

    const searchCriteria = criteriaToSearchCriteria(job.criteria);
    const maxResults = searchCriteria.maxResults ?? config.maxResults;
    const providerErrors: Array<{ provider: string; message: string }> = [];
    let errorCount = 0;

    pipelineDebug("job.run.start", {
      jobId,
      organizationId: context.organizationId,
      userId: context.userId,
      searchCriteria,
      maxResults,
    });

    const pipelineRunId = startPipelineRun({
      jobId,
      organizationId: context.organizationId,
    });

    const pipelineQueue: PipelineStreamEvent[] = [];
    const pipeline = new PipelineRunTracker(jobId, (event) => pipelineQueue.push(event));

    function* drainPipelineEvents(): Generator<LeadIntelligenceRunEvent> {
      while (pipelineQueue.length > 0) {
        yield { type: "pipeline", event: pipelineQueue.shift()! };
      }
    }

    currentJob = await this.jobRepository.update(context.organizationId, jobId, {
      status: "searching",
      errorMessage: null,
      providerErrors: [],
      errorCount: 0,
    });

    const emitProgress = (
      phase: CompanyFinderProgress["phase"],
      message: string,
      extra: Partial<CompanyFinderProgress> = {},
    ): LeadIntelligenceRunEvent => ({
      type: "progress",
      progress: {
        phase,
        message,
        foundCount: extra.foundCount ?? currentJob.foundCount,
        savedCount: extra.savedCount ?? currentJob.savedCount,
        updatedCount: extra.updatedCount ?? currentJob.updatedCount,
        skippedCount: extra.skippedCount ?? currentJob.skippedCount,
        errorCount: extra.errorCount ?? errorCount,
        providerErrors,
        progressPercent: extra.progressPercent ?? progressPercent(phase),
        ...extra,
      },
    });

    yield emitProgress("queued", "Lead Intelligence gestart…", { progressPercent: 5 });
    yield* drainPipelineEvents();
    stepTimer.start("job_setup");

    const allCandidates: LeadCandidate[] = [];

    try {
    deadline.assert("provider_check");
    const searchProviderAvailability = getSearchProviderAvailability("lead-intelligence-engine.runJob");
    const activeSearchProviders = searchProviderAvailability.filter((entry) => entry.active);

    if (activeSearchProviders.length === 0) {
      const skippedProviders = searchProviderAvailability.map((entry) => ({
        name: entry.name,
        reason: entry.skipReason ?? "Niet actief",
      }));
      const noProviderMessage =
        "Er is geen zoekprovider geconfigureerd. Stel minimaal één search API key in (Tavily, Brave, SerpAPI, Google CSE of Bing).";
      const skippedDetails = skippedProviders.map((entry) => `${entry.name}: ${entry.reason}`);

      console.error("[LeadIntelligenceEngine] Geen actieve zoekproviders", {
        organizationId: context.organizationId,
        userId: context.userId,
        activeSearchProviders,
        skippedProviders: skippedProviders.map((entry) => `${entry.name}: ${entry.reason}`),
      });

      currentJob = await this.jobRepository.update(context.organizationId, jobId, {
        status: "failed",
        errorMessage: noProviderMessage,
        providerErrors: skippedProviders.map((entry) => ({
          provider: entry.name,
          message: entry.reason,
        })),
        errorCount: skippedProviders.length || 1,
      });

      yield emitProgress("failed", noProviderMessage, {
        errorCount: skippedProviders.length || 1,
        progressPercent: 100,
      });
      yield { type: "error", message: noProviderMessage };
      yield { type: "complete", job: currentJob };
      completePipelineRun(pipelineRunId, "failed");
      stepTimer.fail("provider_check", noProviderMessage);
      stepTimer.logSummary();
      return;
    }

    stepTimer.complete("provider_check", { resultCount: activeSearchProviders.length, provider: "tavily" });

    if (job.criteria.fastMode !== false) {
      const fastResult = yield* runFastCompanyFinderPipeline({
        context,
        jobId,
        job,
        searchCriteria,
        jobRepository: this.jobRepository,
        companiesService: this.companiesService,
        emitProgress,
        currentJob,
      });
      completePipelineRun(pipelineRunId, fastResult.status === "failed" ? "failed" : "completed");
      stepTimer.logSummary();
      return;
    }

    pipeline.startStep("discovery", { message: "Providers doorzoeken…" });
    yield* drainPipelineEvents();

    const discoveryStepId = startPipelineStep({
      runId: pipelineRunId,
      jobId,
      organizationId: context.organizationId,
      step: "discovery",
    });

    yield emitProgress("searching", "Hiring Signals verzamelen via providers…", {
      progressPercent: 15,
    });

    stepTimer.start("discovery", "tavily");
    deadline.assert("discovery");

    const signalsEngine = await createHiringSignalsEngine(this.companiesService);
    const signalResult = await signalsEngine.collectAndIngest(searchCriteria, {
      organizationId: context.organizationId,
      userId: context.userId,
      jobId,
      timeoutMs: config.discoveryTimeoutMs,
      maxResults,
      maxResultsPerProvider: config.discoveryMaxResultsPerProvider,
      providerConcurrency: config.discoveryConcurrency,
      ingestConcurrency: config.discoveryIngestConcurrency,
    });

    stepTimer.complete("discovery", {
      resultCount: signalResult.candidates.length,
      provider: "tavily",
    });

    const discoveryProviders = signalResult.providerRuns.map((run) => run.displayName).join(", ");
    const discoveryErrors = signalResult.providerRuns
      .filter((run) => !run.success && run.error)
      .map((run) => `${run.displayName}: ${run.error}`);

    pipeline.completeStep("discovery", {
      provider: discoveryProviders || null,
      resultCount: signalResult.providerRuns.reduce((sum, run) => sum + run.resultCount, 0),
      errorCount: discoveryErrors.length,
      errors: discoveryErrors,
      retryCount: signalResult.providerRuns.reduce((sum, run) => sum + run.retryCount, 0),
      message: `${signalResult.providerRuns.length} providers uitgevoerd`,
    });

    pipeline.startStep("hiring_signals", { message: "Signalen verwerken…" });
    yield* drainPipelineEvents();

    allCandidates.push(...signalResult.candidates);
    errorCount += signalResult.providerErrors.length;
    providerErrors.push(...signalResult.providerErrors);

    let savedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const candidate of allCandidates) {
      yield {
        type: "candidate",
        candidate: toLegacyCandidate(candidate),
        saved: false,
        updated: false,
        skipped: false,
      };
    }

    yield {
      type: "event",
      eventType: "discovery_preview",
      payload: { count: allCandidates.length, provider: "tavily" },
    };

    for (const providerError of signalResult.providerErrors) {
      yield {
        type: "event",
        eventType: "provider_failed",
        payload: { provider: providerError.provider, message: providerError.message },
      };
    }

    yield {
      type: "event",
      eventType: "signals_ingested",
      payload: {
        collected: signalResult.signalsCollected,
        created: signalResult.signalsCreated,
        updated: signalResult.signalsUpdated,
        companies: signalResult.companiesResolved,
      },
    };

    pipeline.completeStep("hiring_signals", {
      resultCount: signalResult.signalsCollected,
      errorCount: signalResult.providerErrors.length,
      errors: signalResult.providerErrors.map((entry) => `${entry.provider}: ${entry.message}`),
      message: `${signalResult.signalsCreated} nieuw · ${signalResult.signalsUpdated} bijgewerkt`,
    });
    yield* drainPipelineEvents();

    currentJob = await this.jobRepository.update(context.organizationId, jobId, {
      foundCount: allCandidates.length,
    });

    completePipelineStep({
      runId: pipelineRunId,
      stepId: discoveryStepId,
      resultCount: signalResult.signalsCollected,
      errorCount: signalResult.providerErrors.length,
      errors: signalResult.providerErrors.map((entry) => `${entry.provider}: ${entry.message}`),
    });

    if (allCandidates.length === 0) {
      pipelineWarn("pipeline.search.zero_results", {
        signalsCollected: signalResult.signalsCollected,
        bottleneck: "Geen hiring signals verzameld",
        hasSearchProvider: hasAnySearchProvider(),
      });
    } else {
      pipelineDebug("pipeline.search.completed", {
        totalCandidates: allCandidates.length,
        signals: signalResult.signalsCollected,
      });
    }

    const existingCompanies = await loadExistingCompaniesForDedupe(
      this.companiesService,
      context,
    );

    let discoverySavedCount = 0;
    yield emitProgress("saving", "Discovery-resultaten opslaan…", {
      foundCount: allCandidates.length,
      progressPercent: 40,
    });

    const discoverySaveResults = await runWithConcurrencySettled(
      allCandidates.map((candidate) => async () => {
        if (isExcludedCandidate(candidate, searchCriteria.excludedNames, searchCriteria.excludedSectors)) {
          return { type: "skipped" as const, candidate };
        }

        const match = matchAgainstExisting(candidate, existingCompanies);
        if (match.isDuplicate) {
          return { type: "exists" as const, candidate };
        }

        const saveStarted = Date.now();
        logPipelinePhase({
          phase: "SAVE",
          provider: "supabase",
          company: candidate.name,
          status: "started",
          jobId,
        });

        try {
          const created = await this.companiesService.createDiscoveryCompany(
            context,
            buildDiscoveryCreateInput(candidate, context.userId, candidate.source ?? "tavily"),
          );
          existingCompanies.push(created);
          logPipelinePhase({
            phase: "SAVE",
            provider: "supabase",
            company: candidate.name,
            status: "completed",
            durationMs: Date.now() - saveStarted,
            jobId,
          });
          return { type: "saved" as const, candidate, companyId: created.id as string };
        } catch (error) {
          logPipelinePhase({
            phase: "SAVE",
            provider: "supabase",
            company: candidate.name,
            status: "failed",
            durationMs: Date.now() - saveStarted,
            error,
            jobId,
          });
          throw error;
        }
      }),
      config.companyProcessingConcurrency,
    );

    for (const result of discoverySaveResults) {
      if (result.status === "rejected" || result.value.type !== "saved") {
        continue;
      }

      discoverySavedCount += 1;
      savedCount += 1;
      yield {
        type: "candidate",
        candidate: toLegacyCandidate(result.value.candidate),
        saved: true,
        updated: false,
        skipped: false,
      };
      yield {
        type: "event",
        eventType: "company_saved",
        payload: { name: result.value.candidate.name, mode: "discovery" },
      };
    }

    currentJob = await this.jobRepository.update(context.organizationId, jobId, {
      foundCount: allCandidates.length,
      savedCount,
    });

    const enrichmentStepId = startPipelineStep({
      runId: pipelineRunId,
      jobId,
      organizationId: context.organizationId,
      step: "enrichment",
    });

    yield emitProgress("enriching", "Bedrijven verrijken (website, LinkedIn, vacatures)…", {
      foundCount: allCandidates.length,
      progressPercent: 45,
    });

    pipeline.startStep("crawler", {
      provider: getProviderManager().getAvailableProviders().find((p) => p.category === "crawler" && p.enabled)?.name ?? "Firecrawl",
      message: "Websites crawlen…",
    });
    pipeline.startStep("vacancies", { message: "Vacatures detecteren…" });
    yield* drainPipelineEvents();

    const enrichedCandidates: LeadCandidate[] = [];
    let excludedCount = 0;
    let enrichmentErrors = 0;
    let crawlCount = 0;
    let vacancyTotal = 0;
    const crawlErrors: string[] = [];

    const enrichmentConcurrency = config.companyProcessingConcurrency;

    stepTimer.start("enrichment", "crawler");
    deadline.assert("enrichment");

    const enrichmentResults = await runWithConcurrencySettled(
      allCandidates.map((candidate) => async () => {
        if (isExcludedCandidate(candidate, searchCriteria.excludedNames, searchCriteria.excludedSectors)) {
          return { type: "excluded" as const, candidate };
        }

        try {
          const enriched = await withTimeout(
            enrichRecruitmentCandidate(candidate, searchCriteria, {
              jobId,
              company: candidate.name,
            }),
            config.crawlerTimeoutMs,
            `Enrichment ${candidate.name}`,
          );
          return { type: "enriched" as const, candidate: enriched, enrichmentFailed: false };
        } catch (error) {
          logPipelinePhase({
            phase: "ENRICHMENT",
            provider: "crawler",
            company: candidate.name,
            status: "failed",
            error,
            jobId,
          });
          return { type: "enriched" as const, candidate, enrichmentFailed: true };
        }
      }),
      enrichmentConcurrency,
    );

    for (const result of enrichmentResults) {
      if (result.status === "rejected") {
        enrichmentErrors += 1;
        continue;
      }

      if (result.value.type === "excluded") {
        excludedCount += 1;
        continue;
      }

      if (result.value.enrichmentFailed) {
        enrichmentErrors += 1;
      }

      enrichedCandidates.push(result.value.candidate);
      if (result.value.candidate.website) crawlCount += 1;
      vacancyTotal += result.value.candidate.vacancyCount;
      pipeline.updateStep("crawler", { resultCount: crawlCount });
      pipeline.updateStep("vacancies", { resultCount: vacancyTotal });
      yield { type: "event", eventType: "company_enriched", payload: { name: result.value.candidate.name } };
    }

    if (enrichmentErrors > 0 && allCandidates.length > 0) {
      yield {
        type: "event",
        eventType: "enrichment_partial",
        payload: {
          message: "Discovery voltooid. Verrijking deels mislukt.",
          failedCount: enrichmentErrors,
        },
      };
    }

    stepTimer.complete("enrichment", { resultCount: enrichedCandidates.length, provider: "crawler" });

    pipeline.completeStep("crawler", {
      resultCount: crawlCount,
      errorCount: crawlErrors.length,
      errors: crawlErrors,
      message: `${crawlCount} websites verrijkt`,
    });
    pipeline.completeStep("vacancies", {
      resultCount: vacancyTotal,
      message: `${vacancyTotal} vacatures gedetecteerd`,
    });
    yield* drainPipelineEvents();

    completePipelineStep({
      runId: pipelineRunId,
      stepId: enrichmentStepId,
      resultCount: enrichedCandidates.length,
      errorCount: enrichmentErrors,
    });

    const crawlerStepId = startPipelineStep({
      runId: pipelineRunId,
      jobId,
      organizationId: context.organizationId,
      step: "crawler",
      providerId: getProviderManager().getAvailableProviders().find((p) => p.category === "crawler" && p.enabled)?.id ?? null,
    });

    completePipelineStep({
      runId: pipelineRunId,
      stepId: crawlerStepId,
      resultCount: enrichedCandidates.filter((c) => c.website).length,
      errorCount: enrichmentErrors,
    });

    pipelineDebug("pipeline.enrich.completed", {
      input: allCandidates.length,
      excluded: excludedCount,
      output: enrichedCandidates.length,
    });

    yield emitProgress("deduplicating", "Duplicaten filteren…", {
      foundCount: enrichedCandidates.length,
      progressPercent: 65,
    });

    const uniqueCandidates = dedupeCandidates(enrichedCandidates);

    pipelineDebug("pipeline.dedupe.completed", {
      input: enrichedCandidates.length,
      output: uniqueCandidates.length,
      removed: enrichedCandidates.length - uniqueCandidates.length,
    });

    pipelineDebug("pipeline.dedupe.existing_loaded", { count: existingCompanies.length });

    let duplicateCount = 0;
    let validationFailedCount = 0;
    const aiErrors = 0;

    pipeline.startStep("ai_analysis", { provider: "OpenAI", message: "AI classificatie…" });
    pipeline.startStep("lead_score", { message: "Leadscores berekenen…" });
    pipeline.startStep("saving", { message: "Resultaten opslaan…" });
    pipeline.startStep("ui_update", { message: "UI bijwerken…" });
    yield* drainPipelineEvents();

    const aiStepId = startPipelineStep({
      runId: pipelineRunId,
      jobId,
      organizationId: context.organizationId,
      step: "ai",
    });

    const storageStepId = startPipelineStep({
      runId: pipelineRunId,
      jobId,
      organizationId: context.organizationId,
      step: "storage",
    });

    let aiAnalysisCount = 0;
    let leadScoreCount = 0;
    let uiUpdateCount = 0;

    stepTimer.start("ai_and_save", "openai");
    deadline.assert("ai_and_save");

    const companyResults = await runWithConcurrencySettled(
      uniqueCandidates.map((candidate) => async () => {
        const aiResult = await withTimeout(
          classifyAndSummarizeLead(candidate, searchCriteria),
          config.aiTimeoutMs,
          `AI ${candidate.name}`,
        ).catch(() => ({
          aiSummary: "",
          sector: candidate.sector,
          employeeCountLabel: candidate.employeeCountLabel,
        }));

        const scoredCandidate: LeadCandidate = {
          ...candidate,
          sector: aiResult.sector ?? candidate.sector,
          employeeCountLabel: aiResult.employeeCountLabel ?? candidate.employeeCountLabel,
          aiSummary: aiResult.aiSummary,
        };

        const finalScore = await scoreLeadWithExplanation(scoredCandidate, searchCriteria);
        const match = matchAgainstExisting(scoredCandidate, existingCompanies);

        if (match.isDuplicate && match.matchedCompanyId) {
          const existing = existingCompanies.find((c) => (c.id as string) === match.matchedCompanyId);
          if (existing) {
            const merged = mergeLeadFields(
              existing,
              candidateToCreateInput(scoredCandidate, finalScore, aiResult.aiSummary, context.userId),
            );
            const updateFields = Object.keys(merged);
            if (updateFields.length > 0) {
              await this.companiesService.updateCompany(context, existing.id, merged as UpdateCompanyInput);
              return {
                type: "updated" as const,
                candidate: scoredCandidate,
                finalScore,
                companyId: existing.id as string,
              };
            }
            return { type: "duplicate_skipped" as const, candidate: scoredCandidate, finalScore };
          }
        }

        const created = await this.companiesService.createCompany(
          context,
          candidateToCreateInput(scoredCandidate, finalScore, aiResult.aiSummary, context.userId),
        );
        existingCompanies.push(created);
        return { type: "saved" as const, candidate: scoredCandidate, finalScore, companyId: created.id as string };
      }),
      config.companyProcessingConcurrency,
    );

    for (const result of companyResults) {
      if (result.status === "rejected") {
        validationFailedCount += 1;
        skippedCount += 1;
        continue;
      }

      const payload = result.value;
      aiAnalysisCount += 1;
      leadScoreCount += 1;

      yield {
        type: "event",
        eventType: "scoring_completed",
        payload: { name: payload.candidate.name, score: payload.finalScore.score, priority: payload.finalScore.priority },
      };

      if (payload.type === "saved") {
        savedCount += 1;
        void triggerCompanyAnalysisRefresh({
          organizationId: context.organizationId,
          userId: context.userId,
          companyId: payload.companyId,
        });
        yield {
          type: "candidate",
          candidate: { ...toLegacyCandidate(payload.candidate), leadScore: payload.finalScore.score, leadPriority: payload.finalScore.priority },
          saved: true,
          updated: false,
          skipped: false,
        };
      } else if (payload.type === "updated") {
        updatedCount += 1;
        void triggerCompanyAnalysisRefresh({
          organizationId: context.organizationId,
          userId: context.userId,
          companyId: payload.companyId,
        });
        yield {
          type: "candidate",
          candidate: { ...toLegacyCandidate(payload.candidate), leadScore: payload.finalScore.score, leadPriority: payload.finalScore.priority },
          saved: false,
          updated: true,
          skipped: false,
        };
      } else {
        duplicateCount += 1;
        skippedCount += 1;
        yield {
          type: "candidate",
          candidate: toLegacyCandidate(payload.candidate),
          saved: false,
          updated: false,
          skipped: true,
        };
      }

      uiUpdateCount += 1;
      pipeline.updateStep("saving", { resultCount: savedCount + updatedCount });
      pipeline.updateStep("ui_update", { resultCount: uiUpdateCount });
      yield* drainPipelineEvents();
    }

    stepTimer.complete("ai_and_save", { resultCount: savedCount + updatedCount, provider: "openai" });

    pipeline.completeStep("ai_analysis", {
      resultCount: aiAnalysisCount,
      errorCount: aiErrors,
      message: `${aiAnalysisCount} bedrijven geclassificeerd`,
    });
    pipeline.completeStep("lead_score", {
      resultCount: leadScoreCount,
      message: `${leadScoreCount} scores berekend`,
    });
    pipeline.completeStep("saving", {
      resultCount: savedCount + updatedCount,
      errorCount: validationFailedCount,
      message: `${savedCount} toegevoegd · ${updatedCount} bijgewerkt`,
    });
    pipeline.completeStep("ui_update", {
      resultCount: uiUpdateCount,
      message: `${uiUpdateCount} resultaten naar UI gestreamd`,
    });
    yield* drainPipelineEvents();

    completePipelineStep({
      runId: pipelineRunId,
      stepId: aiStepId,
      resultCount: uniqueCandidates.length,
      errorCount: aiErrors,
    });

    completePipelineStep({
      runId: pipelineRunId,
      stepId: storageStepId,
      resultCount: savedCount + updatedCount,
      errorCount: validationFailedCount,
    });

    const uiStepId = startPipelineStep({
      runId: pipelineRunId,
      jobId,
      organizationId: context.organizationId,
      step: "ui",
    });

    completePipelineStep({
      runId: pipelineRunId,
      stepId: uiStepId,
      resultCount: savedCount + updatedCount + skippedCount,
      errorCount: 0,
    });

    pipelineDebug("pipeline.save.completed", {
      savedCount,
      updatedCount,
      skippedCount,
      duplicateCount,
      validationFailedCount,
      sentToUi: savedCount + updatedCount + skippedCount,
    });

    const finalStatus =
      enrichmentErrors > 0 && savedCount + updatedCount > 0
        ? "partially_completed"
        : errorCount > 0 && savedCount + updatedCount > 0
        ? "partially_completed"
        : errorCount > 0 && savedCount + updatedCount === 0
          ? "failed"
          : "completed";

    const completionMessage =
      enrichmentErrors > 0 && savedCount + updatedCount > 0
        ? "Discovery voltooid. Verrijking deels mislukt."
        : finalStatus === "failed"
          ? "Geen resultaten opgeslagen."
          : `${savedCount} toegevoegd, ${updatedCount} bijgewerkt, ${skippedCount} overgeslagen`;

    currentJob = await this.jobRepository.update(context.organizationId, jobId, {
      status: finalStatus,
      foundCount: allCandidates.length,
      savedCount,
      updatedCount,
      skippedCount,
      errorCount,
      providerErrors,
      errorMessage: finalStatus === "failed" ? "Geen resultaten gevonden." : null,
    });

    yield emitProgress(
      finalStatus === "completed" ? "completed" : finalStatus === "partially_completed" ? "partially_completed" : "failed",
      completionMessage,
      {
        foundCount: uniqueCandidates.length,
        savedCount,
        updatedCount,
        skippedCount,
        errorCount,
        progressPercent: 100,
      },
    );

    yield { type: "event", eventType: "job_completed", payload: { jobId, status: finalStatus } };

    pipelineDebug("pipeline.ui.complete_event", {
      jobId,
      foundCount: uniqueCandidates.length,
      savedCount,
      updatedCount,
      skippedCount,
      status: finalStatus,
    });

    completePipelineRun(pipelineRunId, finalStatus === "failed" ? "failed" : "completed");

    yield {
      type: "event",
      eventType: "step_timing",
      payload: {
        steps: stepTimer.getSteps(),
        slowest: stepTimer.getSlowestStep(),
        totalDurationMs: stepTimer.getSteps().reduce((sum, step) => sum + (step.durationMs ?? 0), 0),
        mode: "full",
      },
    };

    yield { type: "complete", job: currentJob };
    } catch (error) {
      const message =
        error instanceof JobTimeoutError
          ? `Zoekjob time-out (${config.globalJobTimeoutMs}ms) tijdens ${error.phase}`
          : error instanceof Error
            ? error.message
            : "Zoekjob mislukt";

      stepTimer.fail(deadline.isExpired() ? "global_timeout" : "pipeline", message);

      currentJob = await this.jobRepository.update(context.organizationId, jobId, {
        status: "failed",
        errorMessage: message,
        errorCount: Math.max(currentJob.errorCount, 1),
      });

      yield emitProgress("failed", message, { progressPercent: 100, errorCount: 1 });
      yield { type: "error", message };
      yield {
        type: "event",
        eventType: "step_timing",
        payload: { steps: stepTimer.getSteps(), slowest: stepTimer.getSlowestStep(), failed: true },
      };
      completePipelineRun(pipelineRunId, "failed");
      yield { type: "complete", job: currentJob };
    } finally {
      stepTimer.logSummary();
    }
  }
}
