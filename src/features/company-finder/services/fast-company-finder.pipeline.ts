import "server-only";

import type { CompaniesService } from "@/features/companies/services/companies.service";
import type { CompanySearchJob } from "@/features/company-finder/domain";
import {
  JobDeadline,
  JobTimeoutError,
  PipelineStepTimer,
} from "@/features/company-finder/pipeline/pipeline-step-timer";
import { scheduleBackgroundCompanyEnrichment } from "@/features/company-finder/services/background-enrichment.service";
import { buildQualifiedDiscoveryCreateInput } from "@/features/company-finder/services/discovery-save";
import { runFastTavilySearch } from "@/features/company-finder/services/fast-discovery.service";
import { runDiscoveryQualityGate } from "@/features/company-finder/discovery/discovery-quality-gate";
import type { DiscoveryQualityReport, QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import type { CompanySearchJobRepository } from "@/features/company-finder/repositories";
import { getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";
import type {
  CompanySearchCriteria,
  ExternalCompanyCandidate as LeadCandidate,
} from "@/features/lead-intelligence/domain";
import { toFinderProviderId } from "@/features/company-finder/domain";
import type { ExternalCompanyCandidate } from "@/features/company-finder/domain";
import type { LeadIntelligenceContext, LeadIntelligenceRunEvent } from "@/features/lead-intelligence/services/lead-intelligence-engine.service";
import { isExcludedCandidate } from "@/features/lead-intelligence/services/dedupe";
import { runWithConcurrencySettled } from "@/lib/async/run-with-concurrency-settled";
import { logPipelinePhase } from "@/lib/company-finder/pipeline-logger";

function toStreamCandidate(candidate: LeadCandidate): ExternalCompanyCandidate {
  return {
    name: candidate.name,
    city: candidate.city,
    sector: candidate.sector,
    website: candidate.website,
    employeeCountRange: null,
    sourceProviderId: toFinderProviderId(candidate.source ?? "tavily"),
    externalId: candidate.externalId,
    sourceUrl: candidate.sourceUrl,
    leadScore: null,
    leadPriority: null,
    vacancyCount: candidate.vacancyCount ?? 0,
  };
}

export async function* runFastCompanyFinderPipeline(input: {
  context: LeadIntelligenceContext;
  jobId: string;
  job: CompanySearchJob;
  searchCriteria: CompanySearchCriteria;
  jobRepository: CompanySearchJobRepository;
  companiesService: CompaniesService;
  emitProgress: (
    phase: CompanySearchJob["status"],
    message: string,
    extra?: Partial<{
      foundCount: number;
      savedCount: number;
      updatedCount: number;
      skippedCount: number;
      errorCount: number;
      progressPercent: number;
    }>,
  ) => LeadIntelligenceRunEvent;
  currentJob: CompanySearchJob;
}): AsyncGenerator<LeadIntelligenceRunEvent, CompanySearchJob, undefined> {
  const config = getLeadIntelligenceConfig();
  const timer = new PipelineStepTimer(input.jobId);
  const deadline = JobDeadline.fromTimeoutMs(config.globalJobTimeoutMs);
  let currentJob = input.currentJob;
  let savedCount = 0;
  let skippedCount = 0;
  let saveErrorCount = 0;

  try {
  yield input.emitProgress("searching", "Tavily zoekt bedrijven…", { progressPercent: 10 });

  timer.start("tavily_discovery", "tavily");
  deadline.assert("tavily_discovery");
  logPipelinePhase({
    phase: "DISCOVERY",
    provider: "tavily",
    status: "started",
    jobId: input.jobId,
  });

  let candidates: LeadCandidate[] = [];
  let qualityReport: DiscoveryQualityReport = {
    totalUrls: 0,
    rejected: 0,
    blogs: 0,
    directories: 0,
    listings: 0,
    news: 0,
    government: 0,
    social: 0,
    jobboards: 0,
    unknown: 0,
    realCompanies: 0,
    saved: 0,
    rejectedByHeuristics: 0,
    rejectedByAiCategory: 0,
    rejectedByHomepageSignals: 0,
    rejectedByAiValidation: 0,
    rejectedByScore: 0,
  };
  let qualifiedCandidates: QualifiedDiscoveryCandidate[] = [];

  try {
    const discoveryStarted = Date.now();
    const tavily = await runFastTavilySearch(input.searchCriteria, {
      maxResults: Math.min(
        input.searchCriteria.maxResults ?? config.fastModeMaxResults,
        config.fastModeMaxResults,
      ),
      timeoutMs: config.tavilyTimeoutMs,
    });

    timer.start("discovery_quality_gate", "quality");
    deadline.assert("discovery_quality_gate");

    const qualityGate = await runDiscoveryQualityGate({
      results: tavily.results,
      criteria: input.searchCriteria,
      provider: tavily.providerId,
      jobId: input.jobId,
    });

    timer.complete("discovery_quality_gate", {
      resultCount: qualityGate.qualified.length,
      provider: "quality",
    });

    qualityReport = qualityGate.report;
    qualifiedCandidates = qualityGate.qualified;
    candidates = qualityGate.qualified.map((entry) => entry.candidate);

    timer.complete("tavily_discovery", { resultCount: tavily.results.length, provider: "tavily" });
    logPipelinePhase({
      phase: "DISCOVERY",
      provider: "tavily",
      status: "completed",
      durationMs: Date.now() - discoveryStarted,
      resultCount: tavily.results.length,
      jobId: input.jobId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tavily discovery mislukt";
    timer.fail("tavily_discovery", message, { provider: "tavily" });
    logPipelinePhase({
      phase: "DISCOVERY",
      provider: "tavily",
      status: "failed",
      error,
      jobId: input.jobId,
    });
    currentJob = await input.jobRepository.update(input.context.organizationId, input.jobId, {
      status: "failed",
      errorMessage: message,
      errorCount: 1,
    });
    yield input.emitProgress("failed", message, { progressPercent: 100, errorCount: 1 });
    yield { type: "error", message };
    yield {
      type: "event",
      eventType: "step_timing",
      payload: { steps: timer.getSteps(), slowest: timer.getSlowestStep() },
    };
    timer.logSummary();
    yield { type: "complete", job: currentJob };
    return currentJob;
  }

  yield {
    type: "event",
    eventType: "discovery_preview",
    payload: {
      count: candidates.length,
      provider: "tavily",
      totalUrls: qualityReport.totalUrls,
      rejected: qualityReport.rejected,
      realCompanies: qualityReport.realCompanies,
    },
  };

  yield {
    type: "event",
    eventType: "discovery_quality_report",
    payload: qualityReport,
  };

  yield input.emitProgress(
    "saving",
    `${qualityReport.realCompanies} echte bedrijven van ${qualityReport.totalUrls} URLs — opslaan…`,
    {
      foundCount: qualityReport.totalUrls,
      progressPercent: 35,
    },
  );

  timer.start("fast_save", "supabase");
  deadline.assert("fast_save");

  const saveResults = await runWithConcurrencySettled(
    qualifiedCandidates.map((qualified) => async () => {
      const candidate = qualified.candidate;
      if (isExcludedCandidate(candidate, input.searchCriteria.excludedNames, input.searchCriteria.excludedSectors)) {
        return { type: "skipped" as const, candidate };
      }

      const saveStarted = Date.now();
      logPipelinePhase({
        phase: "SAVE",
        provider: "supabase",
        company: candidate.name,
        status: "started",
        jobId: input.jobId,
      });

      try {
        const created = await input.companiesService.createDiscoveryCompany(
          input.context,
          buildQualifiedDiscoveryCreateInput(qualified, input.context.userId),
        );

        logPipelinePhase({
          phase: "SAVE",
          provider: "supabase",
          company: candidate.name,
          status: "completed",
          durationMs: Date.now() - saveStarted,
          jobId: input.jobId,
        });

        scheduleBackgroundCompanyEnrichment({
          organizationId: input.context.organizationId,
          companiesService: input.companiesService,
          context: input.context,
          companyId: created.id as string,
          candidate,
          searchCriteria: input.searchCriteria,
          jobId: input.jobId,
        });

        return { type: "saved" as const, candidate, companyId: created.id as string };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Opslaan mislukt";
        logPipelinePhase({
          phase: "SAVE",
          provider: "supabase",
          company: candidate.name,
          status: "failed",
          durationMs: Date.now() - saveStarted,
          error,
          jobId: input.jobId,
        });
        return { type: "failed" as const, candidate, message };
      }
    }),
    config.companyProcessingConcurrency,
  );

  for (const result of saveResults) {
    if (result.status === "rejected") {
      saveErrorCount += 1;
      skippedCount += 1;
      yield {
        type: "event",
        eventType: "save_failed",
        payload: {
          message: result.reason instanceof Error ? result.reason.message : "Opslaan mislukt",
          phase: "SAVE",
        },
      };
      continue;
    }

    if (result.value.type === "failed") {
      saveErrorCount += 1;
      skippedCount += 1;
      yield {
        type: "event",
        eventType: "save_failed",
        payload: { name: result.value.candidate.name, message: result.value.message, phase: "SAVE" },
      };
      continue;
    }

    if (result.value.type === "skipped") {
      skippedCount += 1;
      continue;
    }

    savedCount += 1;
    yield {
      type: "candidate",
      candidate: toStreamCandidate(result.value.candidate),
      saved: true,
      updated: false,
      skipped: false,
    };
    yield {
      type: "event",
      eventType: "company_saved",
      payload: { name: result.value.candidate.name, mode: "fast" },
    };
    yield input.emitProgress("saving", `Opgeslagen: ${result.value.candidate.name}`, {
      foundCount: candidates.length,
      savedCount,
      skippedCount,
      progressPercent: 35 + Math.round((savedCount / Math.max(candidates.length, 1)) * 55),
    });
  }

  timer.complete("fast_save", { resultCount: savedCount, provider: "supabase" });

  const finalStatus =
    savedCount > 0
      ? "completed"
      : candidates.length > 0
        ? "failed"
        : "failed";
  const errorMessage =
    savedCount > 0
      ? null
      : saveErrorCount > 0
        ? `${saveErrorCount} bedrijven konden niet worden opgeslagen (validatie of database).`
        : "Geen bedrijven opgeslagen na Tavily discovery.";

  currentJob = await input.jobRepository.update(input.context.organizationId, input.jobId, {
    status: finalStatus,
    foundCount: qualityReport.totalUrls,
    savedCount,
    skippedCount: skippedCount + qualityReport.rejected,
    errorCount: saveErrorCount,
    providerErrors: [],
    errorMessage,
  });

  qualityReport.saved = savedCount;

  yield {
    type: "event",
    eventType: "discovery_quality_report",
    payload: qualityReport,
  };

  const completionMessage =
    savedCount > 0
      ? `${savedCount} bedrijven opgeslagen (${qualityReport.rejected} afgewezen) — verrijking op de achtergrond`
      : qualityReport.rejected > 0
        ? `Geen bedrijven opgeslagen: ${qualityReport.rejected} URLs afgewezen (${qualityReport.directories} directories, ${qualityReport.blogs + qualityReport.news} blogs/nieuws)`
        : errorMessage ?? "Geen bedrijven opgeslagen";

  yield input.emitProgress(finalStatus === "completed" ? "completed" : "failed", completionMessage, {
    foundCount: qualityReport.totalUrls,
    savedCount,
    skippedCount: skippedCount + qualityReport.rejected,
    errorCount: saveErrorCount,
    progressPercent: 100,
  });

  yield {
    type: "event",
    eventType: "step_timing",
    payload: {
      steps: timer.getSteps(),
      slowest: timer.getSlowestStep(),
      totalDurationMs: timer.getSteps().reduce((sum, step) => sum + (step.durationMs ?? 0), 0),
      mode: "fast",
    },
  };

  timer.logSummary();
  yield { type: "complete", job: currentJob };
  return currentJob;
  } catch (error) {
    const message =
      error instanceof JobTimeoutError
        ? `Zoekjob time-out (${config.globalJobTimeoutMs}ms) tijdens ${error.phase}`
        : error instanceof Error
          ? error.message
          : "Fast mode mislukt";

    timer.fail(deadline.isExpired() ? "global_timeout" : "pipeline", message);

    currentJob = await input.jobRepository.update(input.context.organizationId, input.jobId, {
      status: "failed",
      errorMessage: message,
      errorCount: Math.max(currentJob.errorCount, 1),
    });

    yield input.emitProgress("failed", message, { progressPercent: 100, errorCount: 1 });
    yield { type: "error", message };
    yield {
      type: "event",
      eventType: "step_timing",
      payload: { steps: timer.getSteps(), slowest: timer.getSlowestStep(), failed: true, mode: "fast" },
    };
    timer.logSummary();
    yield { type: "complete", job: currentJob };
    return currentJob;
  }
}

export { JobTimeoutError, PipelineStepTimer, JobDeadline };
