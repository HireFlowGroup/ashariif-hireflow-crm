import "server-only";

import type { CandidateContext } from "@/features/candidates/domain";
import type { CandidateSourcingSearchCriteria } from "@/features/candidate-discovery/domain/candidate-sourcing-criteria.types";
import type {
  CandidateDiscoveryProposal,
  CandidateDiscoveryRun,
} from "@/features/candidate-discovery/domain/candidate-discovery.persistence.types";
import { getCandidateDiscoveryConfig } from "@/features/candidate-discovery/config/candidate-discovery.config";
import { CandidateDiscoveryError } from "@/features/candidate-discovery/domain/candidate-discovery.errors";
import { createCandidateDiscoveryRepository } from "@/features/candidate-discovery/create-candidate-discovery-repository";
import { rankCandidateDiscoveryResults } from "@/features/candidate-discovery/services/candidate-discovery-rank.service";
import {
  createProviderManagerSearchExecutor,
  runCandidateDiscoverySearch,
} from "@/features/candidate-discovery/services/candidate-discovery-search.service";
import { buildCandidateSourcingQueryPlan } from "@/features/candidate-discovery/services/candidate-sourcing-query-builder.service";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { toVacancyId } from "@/features/vacancies/domain";

export type CandidateDiscoveryRunResult = {
  run: CandidateDiscoveryRun;
  proposals: CandidateDiscoveryProposal[];
};

export async function executeCandidateSourcingRun(
  context: CandidateContext,
  criteria: CandidateSourcingSearchCriteria,
): Promise<CandidateDiscoveryRunResult> {
  const config = getCandidateDiscoveryConfig();
  if (!config.enabled) {
    throw new CandidateDiscoveryError(
      "feature_disabled",
      "Kandidaat sourcing is uitgeschakeld (CANDIDATE_DISCOVERY_ENABLED=false).",
    );
  }

  const vacanciesService = await createVacanciesService();
  const vacancy = await vacanciesService.getVacancy(context, toVacancyId(criteria.vacancyId));
  const queryPlan = buildCandidateSourcingQueryPlan({ vacancy, criteria });

  const repository = await createCandidateDiscoveryRepository();

  const run = await repository.createRun({
    organizationId: context.organizationId,
    vacancyId: vacancy.id,
    createdBy: context.userId,
    status: "running",
    queries: queryPlan.queries,
    queryPlan,
    minMatchScoreUsed: config.minMatchScore,
  });

  await repository.updateRun(context.organizationId, run.id, {
    startedAt: new Date().toISOString(),
  });

  try {
    const executor = await createProviderManagerSearchExecutor();
    const searchOutcome = await runCandidateDiscoverySearch({
      queries: queryPlan.queries,
      executor,
    });

    if (searchOutcome.allQueriesFailed) {
      const firstError = searchOutcome.attempts.find((a) => !a.success);
      await repository.updateRun(context.organizationId, run.id, {
        status: "failed",
        searchAttempts: searchOutcome.attempts,
        providerFailures: searchOutcome.providerFailures,
        errorCode: firstError?.errorCode ?? "all_queries_failed",
        errorMessage: firstError?.errorMessage ?? "Alle zoekopdrachten mislukt.",
        completedAt: new Date().toISOString(),
      });
      throw new CandidateDiscoveryError(
        firstError?.errorCode ?? "all_queries_failed",
        firstError?.errorMessage ?? "Zoekopdrachten mislukt.",
      );
    }

    const rankOutcome = rankCandidateDiscoveryResults({
      vacancy,
      queryPlan,
      searchOutcome,
    });

    const { inserted } = await repository.insertProposals({
      organizationId: context.organizationId,
      vacancyId: vacancy.id,
      runId: run.id,
      ranked: rankOutcome.proposals,
    });

    const status =
      searchOutcome.providerFailures > 0 && rankOutcome.proposals.length > 0
        ? "partial"
        : rankOutcome.proposals.length === 0
          ? "completed"
          : "completed";

    const updatedRun = await repository.updateRun(context.organizationId, run.id, {
      status,
      searchAttempts: searchOutcome.attempts,
      providerMeta: {
        queriesExecuted: searchOutcome.attempts.length,
        rawItems: searchOutcome.items.length,
      },
      proposalCount: inserted.length,
      belowThresholdCount: rankOutcome.belowMinScoreCount,
      ineligibleCount: rankOutcome.ineligibleCount,
      duplicateUrlCount:
        rankOutcome.duplicateUrlCount,
      providerFailures: searchOutcome.providerFailures,
      completedAt: new Date().toISOString(),
    });

    return { run: updatedRun, proposals: inserted };
  } catch (error) {
    if (error instanceof CandidateDiscoveryError) throw error;
    await repository.updateRun(context.organizationId, run.id, {
      status: "failed",
      errorCode: "provider_failure",
      errorMessage: error instanceof Error ? error.message : "Onbekende fout",
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}