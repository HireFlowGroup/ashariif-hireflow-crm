import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CandidateDiscoveryProposal,
  CandidateDiscoveryRun,
  CreateCandidateDiscoveryRunInput,
  InsertProposalsFromRankInput,
  InsertProposalsResult,
  UpdateCandidateDiscoveryRunInput,
  UpdateProposalStatusInput,
} from "@/features/candidate-discovery/domain/candidate-discovery.persistence.types";
import {
  buildProposalInsertRows,
  mapProposalRowToDomain,
  mapRunRowToDomain,
  type CandidateDiscoveryProposalRow,
  type CandidateDiscoveryRunRow,
} from "@/features/candidate-discovery/repositories/candidate-discovery.mapper";
import { CandidateDiscoveryRepositoryError } from "@/features/candidate-discovery/repositories/candidate-discovery.repository.errors";
import type { CandidateDiscoveryRepository } from "@/features/candidate-discovery/repositories/candidate-discovery.repository";
import type { Database } from "@/types/database";

export class SupabaseCandidateDiscoveryRepository implements CandidateDiscoveryRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createRun(input: CreateCandidateDiscoveryRunInput): Promise<CandidateDiscoveryRun> {
    const { data, error } = await this.client
      .from("candidate_discovery_runs")
      .insert({
        organization_id: input.organizationId,
        vacancy_id: input.vacancyId,
        created_by: input.createdBy,
        status: input.status ?? "pending",
        queries: input.queries,
        query_plan: input.queryPlan,
        min_match_score_used: input.minMatchScoreUsed,
        search_attempts: [],
        provider_meta: {},
      } as never)
      .select("*")
      .single();

    if (error || !data) {
      throw new CandidateDiscoveryRepositoryError("Discovery-run kon niet worden aangemaakt.");
    }

    return mapRunRowToDomain(data as CandidateDiscoveryRunRow);
  }

  async updateRun(
    organizationId: string,
    runId: string,
    patch: UpdateCandidateDiscoveryRunInput,
  ): Promise<CandidateDiscoveryRun> {
    const updatePayload: Record<string, unknown> = {};
    if (patch.status !== undefined) updatePayload.status = patch.status;
    if (patch.searchAttempts !== undefined) updatePayload.search_attempts = patch.searchAttempts;
    if (patch.providerMeta !== undefined) updatePayload.provider_meta = patch.providerMeta;
    if (patch.proposalCount !== undefined) updatePayload.proposal_count = patch.proposalCount;
    if (patch.belowThresholdCount !== undefined) {
      updatePayload.below_threshold_count = patch.belowThresholdCount;
    }
    if (patch.ineligibleCount !== undefined) updatePayload.ineligible_count = patch.ineligibleCount;
    if (patch.duplicateUrlCount !== undefined) updatePayload.duplicate_url_count = patch.duplicateUrlCount;
    if (patch.providerFailures !== undefined) updatePayload.provider_failures = patch.providerFailures;
    if (patch.errorCode !== undefined) updatePayload.error_code = patch.errorCode;
    if (patch.errorMessage !== undefined) updatePayload.error_message = patch.errorMessage;
    if (patch.startedAt !== undefined) updatePayload.started_at = patch.startedAt;
    if (patch.completedAt !== undefined) updatePayload.completed_at = patch.completedAt;

    const { data, error } = await this.client
      .from("candidate_discovery_runs")
      .update(updatePayload as never)
      .eq("id", runId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (error || !data) {
      throw new CandidateDiscoveryRepositoryError("Discovery-run kon niet worden bijgewerkt.");
    }

    return mapRunRowToDomain(data as CandidateDiscoveryRunRow);
  }

  async getRun(organizationId: string, runId: string): Promise<CandidateDiscoveryRun | null> {
    const { data, error } = await this.client
      .from("candidate_discovery_runs")
      .select("*")
      .eq("id", runId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      throw new CandidateDiscoveryRepositoryError("Discovery-run kon niet worden opgehaald.");
    }

    return data ? mapRunRowToDomain(data as CandidateDiscoveryRunRow) : null;
  }

  async listRunsForVacancy(
    organizationId: string,
    vacancyId: string,
    limit = 20,
  ): Promise<CandidateDiscoveryRun[]> {
    const { data, error } = await this.client
      .from("candidate_discovery_runs")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("vacancy_id", vacancyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new CandidateDiscoveryRepositoryError("Discovery-runs konden niet worden opgehaald.");
    }

    return (data ?? []).map((row) => mapRunRowToDomain(row as CandidateDiscoveryRunRow));
  }

  async insertProposals(input: InsertProposalsFromRankInput): Promise<InsertProposalsResult> {
    const rows = buildProposalInsertRows({
      organizationId: input.organizationId,
      vacancyId: input.vacancyId,
      runId: input.runId,
      ranked: input.ranked,
    });

    const inserted: CandidateDiscoveryProposal[] = [];
    let skippedDuplicates = 0;

    for (const row of rows) {
      const { data, error } = await this.client
        .from("candidate_discovery_proposals")
        .insert(row as never)
        .select("*")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          skippedDuplicates += 1;
          continue;
        }
        throw new CandidateDiscoveryRepositoryError("Kandidaatvoorstel kon niet worden opgeslagen.");
      }

      if (data) {
        inserted.push(mapProposalRowToDomain(data as CandidateDiscoveryProposalRow));
      }
    }

    return { inserted, skippedDuplicates };
  }

  async listProposalsByRun(organizationId: string, runId: string): Promise<CandidateDiscoveryProposal[]> {
    const { data, error } = await this.client
      .from("candidate_discovery_proposals")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("run_id", runId)
      .order("rank", { ascending: true });

    if (error) {
      throw new CandidateDiscoveryRepositoryError("Voorstellen konden niet worden opgehaald.");
    }

    return (data ?? []).map((row) => mapProposalRowToDomain(row as CandidateDiscoveryProposalRow));
  }

  async updateProposalStatus(input: UpdateProposalStatusInput): Promise<CandidateDiscoveryProposal> {
    const { data, error } = await this.client
      .from("candidate_discovery_proposals")
      .update({
        approval_status: input.approvalStatus,
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date().toISOString(),
        saved_candidate_id: input.savedCandidateId ?? null,
      } as never)
      .eq("id", input.proposalId)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();

    if (error || !data) {
      throw new CandidateDiscoveryRepositoryError("Voorstelstatus kon niet worden bijgewerkt.");
    }

    return mapProposalRowToDomain(data as CandidateDiscoveryProposalRow);
  }
}