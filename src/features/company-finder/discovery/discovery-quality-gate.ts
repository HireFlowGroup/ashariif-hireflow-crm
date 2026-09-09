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
import {
  applyDiscoveryHeuristics,
  rejectionReasonFromHeuristic,
} from "@/features/company-finder/discovery/discovery-heuristics";
import { evaluateDiscoveryDecision } from "@/features/company-finder/discovery/discovery-decision";
import { resolveOfficialCompanyIdentity } from "@/features/company-finder/discovery/company-identity.service";
import {
  classifyBusinessModel,
  isExcludedBusinessModel,
} from "@/features/company-finder/discovery/business-model-classifier.service";
import { isGenericCompanyLabel } from "@/features/company-finder/discovery/generic-company-label";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import type {
  DiscoveryQualityReport,
  DiscoveryUrlCategory,
  QualifiedDiscoveryCandidate,
  RejectedDiscoveryUrl,
} from "@/features/company-finder/discovery/discovery-quality.types";
import { DISCOVERY_REVIEW_CONFIDENCE_MIN } from "@/features/company-finder/discovery/discovery-quality.types";
import {
  fetchHomepageSignals,
  formatCompanyAcceptanceSignals,
  formatHomepageSignals,
} from "@/features/company-finder/discovery/homepage-signals";
import { getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";
import { runWithConcurrencySettled } from "@/lib/async/run-with-concurrency-settled";
import { logDiscoveryRejection, logPipelinePhase } from "@/lib/company-finder/pipeline-logger";

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
    forums: 0,
    unknown: 0,
    realCompanies: 0,
    review: 0,
    saved: 0,
    rejectedByHeuristics: 0,
    rejectedByAiCategory: 0,
    rejectedByHomepageSignals: 0,
    rejectedByAiValidation: 0,
    rejectedByScore: 0,
    rejectedByDuplicate: 0,
    rejectedByLowConfidence: 0,
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
    case "forum":
      report.forums += 1;
      break;
    case "unknown":
      report.unknown += 1;
      break;
    default:
      break;
  }
}

function reject(
  report: DiscoveryQualityReport,
  rejected: RejectedDiscoveryUrl[],
  entry: RejectedDiscoveryUrl,
  jobId?: string,
) {
  report.rejected += 1;
  incrementCategory(report, entry.category);
  rejected.push(entry);
  logDiscoveryRejection({
    url: entry.url,
    title: entry.title,
    reason: entry.reason,
    detail: entry.detail,
    score: entry.score,
    jobId,
  });
}

function toCandidate(
  result: TavilyDiscoveryResult,
  criteria: CompanySearchCriteria,
  provider: string,
): ExternalCompanyCandidate | null {
  const rawTitle = cleanCompanyTitle(result.title);
  if (isGenericCompanyLabel(rawTitle)) {
    return null;
  }
  const name = rawTitle;
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

/**
 * Discovery quality gate (ashariif + Make-HireFlow consolidation):
 * 1. Dedup → duplicate
 * 2. High-confidence heuristics only
 * 3. Soft AI URL category (non-company still filtered)
 * 4. Homepage signals + ashariif identity / business-model checks
 * 5. AI confidence bands: >70 company, 50–70 Review, else reject
 */
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
    if (seen.has(dedupeKey)) {
      report.rejectedByDuplicate += 1;
      reject(
        report,
        rejected,
        {
          url: result.url,
          title: result.title,
          category: "unknown",
          reason: "duplicate",
          detail: `Duplicate domein/naam: ${dedupeKey}`,
        },
        input.jobId,
      );
      continue;
    }
    seen.add(dedupeKey);

    const heuristic = applyDiscoveryHeuristics({
      url: result.url,
      title: result.title,
      description: result.description,
    });

    if (heuristic.rejected) {
      const category = heuristic.category ?? "unknown";
      report.rejectedByHeuristics += 1;
      reject(
        report,
        rejected,
        {
          url: result.url,
          title: result.title,
          category,
          reason: rejectionReasonFromHeuristic(heuristic),
          detail: heuristic.detail ?? "Heuristische afwijzing (hoge zekerheid)",
        },
        input.jobId,
      );
      continue;
    }

    const candidate = toCandidate(result, input.criteria, provider);
    if (!candidate?.website) {
      report.rejectedByHeuristics += 1;
      reject(
        report,
        rejected,
        {
          url: result.url,
          title: result.title,
          category: "unknown",
          reason: "missing_website",
          detail: "Geen bruikbare website",
        },
        input.jobId,
      );
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
      report.rejectedByAiCategory += 1;
      reject(
        report,
        rejected,
        {
          url: entry.result.url,
          title: entry.result.title,
          category: classification.category,
          reason: "ai_url_category",
          detail: `AI classificatie: ${classification.category}`,
        },
        input.jobId,
      );
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
    hasCompanyAcceptanceSignal: boolean;
    signalSummary: string;
    companySignalSummary: string;
  }> = [];

  const recruiterConfig = getAiRecruiterConfig();

  for (const settled of homepageResults) {
    if (settled.status === "rejected") continue;

    const { result, homepage } = settled.value;
    let candidate = toCandidate(result, input.criteria, provider);
    if (!candidate) continue;

    // Soft gate: prefer ≥1 company acceptance signal; AI >70 can still accept later.
    // Do not hard-reject here solely on signal count — decision layer handles that.

    const identity = await resolveOfficialCompanyIdentity({
      searchTitle: result.title,
      url: candidate.website ?? result.url,
      description: result.description,
      html: homepage.html ?? null,
      fetchHtml: false,
    });

    const businessModel = classifyBusinessModel({
      name: identity.officialName ?? candidate.name,
      url: candidate.website ?? result.url,
      description: result.description,
      sector: candidate.sector,
      html: homepage.html ?? null,
      excludeRecruitmentAgencies: recruiterConfig.excludeRecruitmentAgencies,
    });

    if (isExcludedBusinessModel(businessModel.classification, recruiterConfig.excludeRecruitmentAgencies)) {
      report.rejectedByHeuristics += 1;
      reject(
        report,
        rejected,
        {
          url: result.url,
          title: result.title,
          category: "directory",
          reason: "directory",
          detail: `Concurrent uitgesloten: ${businessModel.classification} — ${businessModel.reasons.join("; ")}`,
        },
        input.jobId,
      );
      continue;
    }

    const resolvedName = identity.officialName ?? candidate.name;
    const resolvedDomain = candidate.domain ?? candidate.website ?? result.url;

    if (
      identity.unresolved
      || !resolvedName
      || isGenericCompanyLabel(resolvedName)
      || isGenericCompanyLabel(result.title)
      || !resolvedDomain
    ) {
      report.rejectedByHeuristics += 1;
      reject(
        report,
        rejected,
        {
          url: result.url,
          title: result.title,
          category: "unknown",
          reason: "heuristic_title",
          detail: identity.unresolved
            ? "Bedrijfsidentiteit niet betrouwbaar vastgesteld (unresolved_company_identity)"
            : isGenericCompanyLabel(resolvedName)
              ? `Generieke bedrijfslabel afgewezen: ${resolvedName}`
              : `Generieke titel afgewezen: ${result.title}`,
        },
        input.jobId,
      );
      continue;
    }

    candidate = {
      ...candidate,
      name: resolvedName,
      normalizedName: normalizeCompanyName(resolvedName),
      confidence: Math.max(candidate.confidence ?? 0, identity.confidence),
      description: [
        candidate.description,
        `Identity: ${identity.source} (${Math.round(identity.confidence * 100)}%)`,
      ].filter(Boolean).join(" · "),
    };

    signalPassed.push({
      result,
      candidate,
      signalCount: homepage.signalCount,
      hasCompanyAcceptanceSignal: homepage.hasCompanyAcceptanceSignal,
      signalSummary: formatHomepageSignals(homepage.signals),
      companySignalSummary: formatCompanyAcceptanceSignals(homepage.signals),
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
    const confidence = validation.confidence ?? validation.score;

    const outcome = evaluateDiscoveryDecision({
      verdict: validation.verdict,
      confidence,
      hasCompanyAcceptanceSignal: entry.hasCompanyAcceptanceSignal,
    });

    if (outcome.action === "reject") {
      if (outcome.reason === "missing_company_signals") {
        report.rejectedByHomepageSignals += 1;
      } else {
        report.rejectedByAiValidation += 1;
        report.rejectedByLowConfidence += 1;
        if (confidence < DISCOVERY_REVIEW_CONFIDENCE_MIN) {
          report.rejectedByScore += 1;
        }
      }

      reject(
        report,
        rejected,
        {
          url: entry.result.url,
          title: entry.result.title,
          category: validation.verdict === "company" ? "company" : "unknown",
          reason: outcome.reason,
          detail: outcome.detail,
          score: outcome.confidence,
        },
        input.jobId,
      );
      continue;
    }

    if (outcome.saveStatus === "review") {
      report.review += 1;
    }
    report.realCompanies += 1;

    const discoveryReason = [
      `ai:${validation.verdict}`,
      `confidence:${outcome.confidence}`,
      `save:${outcome.saveStatus}`,
      `company_signals:${entry.companySignalSummary || "geen"}`,
      entry.signalSummary,
      `validation:${validation.companyType}`,
    ].join(" | ");

    qualified.push({
      candidate: {
        ...entry.candidate,
        confidence: outcome.confidence / 100,
        description: entry.candidate.description,
      },
      companyType: validation.companyType,
      companyConfidence: outcome.confidence,
      discoveryReason,
      discoveryProvider: provider,
      urlCategory: "company",
      homepageSignalCount: entry.signalCount,
      saveStatus: outcome.saveStatus,
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
