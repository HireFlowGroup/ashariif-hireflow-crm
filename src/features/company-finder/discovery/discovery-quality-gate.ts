import "server-only";

import type { CompanySearchCriteria, ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { createEmptyCandidate } from "@/features/lead-intelligence/providers/types";
import {
  cleanCompanyTitle,
  extractDomain,
  normalizeCompanyName,
} from "@/features/lead-intelligence/services/recruitment-normalize";
import {
  classifyDiscoveryUrls,
  validateCompanyCandidates,
} from "@/features/company-finder/discovery/discovery-ai-classifier";
import { applyDiscoveryHeuristics } from "@/features/company-finder/discovery/discovery-heuristics";
import {
  countHomepageSignals,
  fetchHomepageSignals,
  formatHomepageSignals,
} from "@/features/company-finder/discovery/homepage-signals";
import type {
  DiscoveryQualityReport,
  DiscoveryUrlCategory,
  QualifiedDiscoveryCandidate,
  RejectedDiscoveryUrl,
} from "@/features/company-finder/discovery/discovery-quality.types";
import {
  DISCOVERY_MIN_SAVE_SCORE,
} from "@/features/company-finder/discovery/discovery-quality.types";
import { getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";
import { runWithConcurrencySettled } from "@/lib/async/run-with-concurrency-settled";
import { logPipelinePhase } from "@/lib/company-finder/pipeline-logger";

export type TavilyDiscoveryResult = {
  title: string;
  url: string;
  description?: string | null;
};

export type DiscoveryQualityGateResult = {
  qualified: QualifiedDiscoveryCandidate[];
  rejected: RejectedDiscoveryUrl[];
  report: DiscoveryQualityReport;
};

function emptyReport(totalUrls = 0): DiscoveryQualityReport {
  return {
    totalUrls,
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
}

function incrementCategory(report: DiscoveryQualityReport, category: DiscoveryUrlCategory) {
  switch (category) {
    case "blog":
      report.blogs += 1;
      break;
    case "directory":
      report.directories += 1;
      break;
    case "listing":
      report.listings += 1;
      break;
    case "news":
      report.news += 1;
      break;
    case "government":
      report.government += 1;
      break;
    case "social":
      report.social += 1;
      break;
    case "jobboard":
      report.jobboards += 1;
      break;
    case "unknown":
      report.unknown += 1;
      break;
    default:
      break;
  }
}

function toCandidate(
  result: TavilyDiscoveryResult,
  criteria: CompanySearchCriteria,
  provider: string,
): ExternalCompanyCandidate | null {
  const name = cleanCompanyTitle(result.title);
  if (!name || name.length < 2) return null;

  const domain = extractDomain(result.url);

  return createEmptyCandidate({
    externalId: `${provider}:${domain ?? normalizeCompanyName(name)}`,
    name,
    normalizedName: normalizeCompanyName(name),
    website: result.url.startsWith("http") ? result.url : null,
    domain,
    city: criteria.city ?? null,
    region: criteria.region ?? null,
    province: criteria.region ?? null,
    sector: criteria.sector ?? null,
    source: provider,
    sourceUrl: result.url,
    description: result.description ?? null,
    confidence: 0.65,
    vacancyCount: 0,
  });
}

export async function runDiscoveryQualityGate(input: {
  results: TavilyDiscoveryResult[];
  criteria: CompanySearchCriteria;
  provider?: string;
  jobId?: string;
}): Promise<DiscoveryQualityGateResult> {
  const config = getLeadIntelligenceConfig();
  const provider = input.provider ?? "tavily";
  const report = emptyReport(input.results.length);
  const rejected: RejectedDiscoveryUrl[] = [];
  const qualified: QualifiedDiscoveryCandidate[] = [];

  logPipelinePhase({
    phase: "DISCOVERY",
    provider,
    status: "started",
    resultCount: input.results.length,
    jobId: input.jobId,
  });

  const seen = new Set<string>();
  const heuristicPassed: Array<{
    result: TavilyDiscoveryResult;
    candidate: ExternalCompanyCandidate;
  }> = [];

  for (const result of input.results) {
    const dedupeKey = extractDomain(result.url) ?? normalizeCompanyName(cleanCompanyTitle(result.title));
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const heuristic = applyDiscoveryHeuristics({
      url: result.url,
      title: result.title,
      description: result.description,
    });

    if (heuristic.rejected) {
      const category = heuristic.category ?? "unknown";
      report.rejected += 1;
      report.rejectedByHeuristics += 1;
      incrementCategory(report, category);
      rejected.push({
        url: result.url,
        title: result.title,
        category,
        reason: heuristic.reason ?? "heuristic_title",
        detail: heuristic.detail ?? "Heuristische afwijzing",
      });
      continue;
    }

    const candidate = toCandidate(result, input.criteria, provider);
    if (!candidate?.website) {
      report.rejected += 1;
      report.rejectedByHeuristics += 1;
      rejected.push({
        url: result.url,
        title: result.title,
        category: "unknown",
        reason: "missing_website",
        detail: "Geen bruikbare website",
      });
      continue;
    }

    heuristicPassed.push({ result, candidate });
  }

  if (heuristicPassed.length === 0) {
    logPipelinePhase({
      phase: "DISCOVERY",
      provider,
      status: "completed",
      resultCount: 0,
      jobId: input.jobId,
    });
    return { qualified, rejected, report };
  }

  const classifications = await classifyDiscoveryUrls(
    heuristicPassed.map(({ result }) => ({
      url: result.url,
      title: result.title,
      description: result.description,
    })),
  );

  const companyPassed: typeof heuristicPassed = [];

  for (let index = 0; index < heuristicPassed.length; index += 1) {
    const entry = heuristicPassed[index]!;
    const classification = classifications[index]!;

    if (classification.category !== "company") {
      report.rejected += 1;
      report.rejectedByAiCategory += 1;
      incrementCategory(report, classification.category);
      rejected.push({
        url: entry.result.url,
        title: entry.result.title,
        category: classification.category,
        reason: "ai_url_category",
        detail: `AI classificatie: ${classification.category}`,
      });
      continue;
    }

    companyPassed.push(entry);
  }

  if (companyPassed.length === 0) {
    logPipelinePhase({
      phase: "DISCOVERY",
      provider,
      status: "completed",
      resultCount: 0,
      jobId: input.jobId,
    });
    return { qualified, rejected, report };
  }

  const homepageResults = await runWithConcurrencySettled(
    companyPassed.map(({ result }) => async () => {
      const homepage = await fetchHomepageSignals(result.url, config.crawlerTimeoutMs);
      return { result, homepage };
    }),
    config.companyProcessingConcurrency,
  );

  const signalPassed: Array<{
    result: TavilyDiscoveryResult;
    candidate: ExternalCompanyCandidate;
    signalCount: number;
    signalSummary: string;
  }> = [];

  for (const settled of homepageResults) {
    if (settled.status === "rejected") continue;

    const { result, homepage } = settled.value;
    const candidate = toCandidate(result, input.criteria, provider);
    if (!candidate) continue;

    if (homepage.signalCount < 2) {
      report.rejected += 1;
      report.rejectedByHomepageSignals += 1;
      rejected.push({
        url: result.url,
        title: result.title,
        category: "company",
        reason: "insufficient_homepage_signals",
        detail: `Homepage signalen: ${homepage.signalCount}/10 (${formatHomepageSignals(homepage.signals) || "geen"})`,
      });
      continue;
    }

    signalPassed.push({
      result,
      candidate,
      signalCount: homepage.signalCount,
      signalSummary: formatHomepageSignals(homepage.signals),
    });
  }

  if (signalPassed.length === 0) {
    logPipelinePhase({
      phase: "DISCOVERY",
      provider,
      status: "completed",
      resultCount: 0,
      jobId: input.jobId,
    });
    return { qualified, rejected, report };
  }

  const validations = await validateCompanyCandidates(
    signalPassed.map((entry) => ({
      url: entry.result.url,
      title: entry.result.title,
      description: entry.result.description,
      signalCount: entry.signalCount,
      signalSummary: entry.signalSummary,
    })),
  );

  for (let index = 0; index < signalPassed.length; index += 1) {
    const entry = signalPassed[index]!;
    const validation = validations[index]!;

    if (validation.verdict !== "company") {
      report.rejected += 1;
      report.rejectedByAiValidation += 1;
      incrementCategory(report, validation.companyType === "news" ? "news" : "directory");
      rejected.push({
        url: entry.result.url,
        title: entry.result.title,
        category: "company",
        reason: "ai_not_company",
        detail: `AI validatie: not_company (${validation.companyType})`,
        score: validation.score,
      });
      continue;
    }

    if (validation.score < DISCOVERY_MIN_SAVE_SCORE) {
      report.rejected += 1;
      report.rejectedByScore += 1;
      rejected.push({
        url: entry.result.url,
        title: entry.result.title,
        category: "company",
        reason: "score_below_threshold",
        detail: `Score ${validation.score} onder drempel ${DISCOVERY_MIN_SAVE_SCORE}`,
        score: validation.score,
      });
      continue;
    }

    report.realCompanies += 1;

    const discoveryReason = [
      "url_category:company",
      `homepage_signals:${entry.signalCount}`,
      entry.signalSummary,
      `validation:${validation.companyType}`,
      `score:${validation.score}`,
    ].join(" | ");

    qualified.push({
      candidate: {
        ...entry.candidate,
        confidence: validation.score / 100,
        description: entry.candidate.description,
      },
      companyType: validation.companyType,
      companyConfidence: validation.score,
      discoveryReason,
      discoveryProvider: provider,
      urlCategory: "company",
      homepageSignalCount: entry.signalCount,
    });
  }

  logPipelinePhase({
    phase: "DISCOVERY",
    provider,
    status: "completed",
    resultCount: qualified.length,
    jobId: input.jobId,
  });

  return { qualified, rejected, report };
}

export { countHomepageSignals };
