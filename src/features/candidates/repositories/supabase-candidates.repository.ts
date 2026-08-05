import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Candidate,
  CandidateContext,
  CandidateId,
  ListCandidatesInput,
  ListCandidatesResult,
} from "@/features/candidates/domain";
import { mapCandidateRowToDomain } from "@/features/candidates/repositories/candidate.mapper";
import type { CandidatesRepository } from "@/features/candidates/repositories/candidates.repository";
import { CandidatesRepositoryError } from "@/features/candidates/repositories/errors";
import type { Database } from "@/types/database";

export class SupabaseCandidatesRepository implements CandidatesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getById(organizationId: string, candidateId: CandidateId): Promise<Candidate | null> {
    const { data, error } = await this.client
      .from("candidates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", candidateId)
      .maybeSingle();

    if (error) {
      throw new CandidatesRepositoryError("Kandidaat kon niet worden opgehaald.");
    }

    return data ? mapCandidateRowToDomain(data) : null;
  }

  async list(organizationId: string, input: ListCandidatesInput): Promise<ListCandidatesResult> {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    let query = this.client
      .from("candidates")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (input.status) {
      query = query.eq("status", input.status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new CandidatesRepositoryError("Kandidaten konden niet worden opgehaald.");
    }

    return {
      candidates: (data ?? []).map(mapCandidateRowToDomain),
      total: count ?? 0,
    };
  }
}

export type { CandidateContext };
