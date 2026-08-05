import "server-only";

import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import type { TavilyDiscoveryResult } from "@/features/company-finder/discovery/discovery-quality-gate";
import { classifySearchResult } from "@/features/company-finder/discovery/result-classifier.service";
import {
  buildVacancyDrivenDiscoveryQueries,
  scaleQueriesForMaxCompanies,
  type DiscoveryQueryVariant,
} from "@/features/ai-recruiter/services/discovery-query-builder.service";
import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import { withTimeout } from "@/features/lead-intelligence/config/providers.config";

export type DiscoveryQueryDiagnostic = {
  query: string;
  intent: DiscoveryQueryVariant["intent"];
  label: string;
  rawResultCount: number;
  companyResults: number;
  vacancyResults: number;
  directoryResults: number;
  rejectedResults: number;
  durationMs: number;
  error: string | null;
};

export type MultiQueryDiscoveryResult = {
  results: TavilyDiscoveryResult[];
  providerId: string;
  queries: DiscoveryQueryDiagnostic[];
  totalRawResults: number;
  classifiedCounts: {
    company: number;
    vacancy: number;
    company_careers_page: number;
    vacancy_board: number;
    directory: number;
    article: number;
    search_result_page: number;
    unknown: number;
  };
};

function dedupeResults(results: TavilyDiscoveryResult[]): TavilyDiscoveryResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.url.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runFastTavilySearch(
  criteria: CompanySearchCriteria,
  options: { maxResults: number; timeoutMs: number; searchPlan?: import("@/features/ai-recruiter/domain/types").AiRecruiterSearchPlan },
): Promise<MultiQueryDiscoveryResult> {
  const queryVariants = scaleQueriesForMaxCompanies(
    buildVacancyDrivenDiscoveryQueries(criteria, options.searchPlan),
    options.maxResults,
  );

  const perQueryMax = Math.max(5, Math.ceil(options.maxResults / Math.max(queryVariants.length, 1)));
  const allResults: TavilyDiscoveryResult[] = [];
  const diagnostics: DiscoveryQueryDiagnostic[] = [];
  const classifiedCounts: MultiQueryDiscoveryResult["classifiedCounts"] = {
    company: 0,
    vacancy: 0,
    company_careers_page: 0,
    vacancy_board: 0,
    directory: 0,
    article: 0,
    search_result_page: 0,
    unknown: 0,
  };

  let providerId = "tavily";

  for (const variant of queryVariants) {
    const started = Date.now();
    let rawResultCount = 0;
    let error: string | null = null;
    let companyResults = 0;
    let vacancyResults = 0;
    let directoryResults = 0;
    let rejectedResults = 0;

    try {
      const chain = await withTimeout(
        getProviderManager().executeSearchChain(variant.query, perQueryMax),
        options.timeoutMs,
        `Discovery query: ${variant.label}`,
      );

      providerId = chain.meta?.providerId ?? providerId;
      rawResultCount = chain.results.length;

      for (const result of chain.results) {
        const classified = classifySearchResult({
          title: result.title,
          url: result.url,
          description: result.description ?? null,
        });

        classifiedCounts[classified.resultType] += 1;

        if (!classified.shouldSaveAsCompany) {
          rejectedResults += 1;
          if (classified.resultType === "vacancy") vacancyResults += 1;
          if (classified.resultType === "directory") directoryResults += 1;
          continue;
        }

        companyResults += 1;
        allResults.push({
          title: classified.employerName ?? result.title,
          url: result.url,
          description: result.description ?? null,
        });
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Query mislukt";
    }

    diagnostics.push({
      query: variant.query,
      intent: variant.intent,
      label: variant.label,
      rawResultCount,
      companyResults,
      vacancyResults,
      directoryResults,
      rejectedResults,
      durationMs: Date.now() - started,
      error,
    });
  }

  return {
    results: dedupeResults(allResults).slice(0, options.maxResults),
    providerId,
    queries: diagnostics,
    totalRawResults: diagnostics.reduce((sum, q) => sum + q.rawResultCount, 0),
    classifiedCounts,
  };
}

/** Backward-compatible export for callers expecting the old shape. */
export async function runFastTavilySearchLegacy(
  criteria: CompanySearchCriteria,
  options: { maxResults: number; timeoutMs: number },
): Promise<{ results: TavilyDiscoveryResult[]; providerId: string }> {
  const result = await runFastTavilySearch(criteria, options);
  return { results: result.results, providerId: result.providerId };
}
