import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Candidate,
  CandidateId,
  CreateCandidateFromDiscoveryInput,
  ListCandidatesInput,
  ListCandidatesResult,
} from "@/features/candidates/domain";
import {
  buildCandidateInsertFromDiscovery,
  mapCandidateRowToDomain,
} from "@/features/candidates/repositories/candidate.mapper";
import { normalizeLinkedInProfileUrl } from "@/features/candidate-discovery/services/linkedin-profile-url.validator";
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

  async findByLinkedInUrl(organizationId: string, linkedinUrl: string): Promise<Candidate | null> {
    const normalized = normalizeLinkedInProfileUrl(linkedinUrl);
    if (!normalized.ok) return null;

    const { data, error } = await this.client
      .from("candidates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("linkedin_url", normalized.value.normalizedUrl)
      .maybeSingle();

    if (error) {
      throw new CandidatesRepositoryError("Kandidaat kon niet worden opgezocht op LinkedIn-URL.");
    }

    return data ? mapCandidateRowToDomain(data) : null;
  }

  async createFromDiscovery(
    organizationId: string,
    userId: string,
    input: CreateCandidateFromDiscoveryInput,
  ): Promise<Candidate> {
    const row = buildCandidateInsertFromDiscovery({
      organizationId,
      ownerId: userId,
      proposal: {
        firstName: input.proposal.firstName,
        lastName: input.proposal.lastName,
        candidateCurrentRole: input.proposal.candidateCurrentRole,
        location: input.proposal.location,
        summary: input.proposal.summary,
        skills: input.proposal.skills,
        experienceYears: input.proposal.experienceYears,
        linkedinUrl: input.proposal.linkedinUrl,
        sourceProvider: input.proposal.sourceProvider,
        matchScore: input.proposal.matchScore,
      },
    });

    const { data, error } = await this.client
      .from("candidates")
      .insert({
        organization_id: row.organization_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        source: row.source,
        status: row.status,
        candidate_current_role: row.candidate_current_role,
        location: row.location,
        summary: row.summary,
        skills: row.skills,
        experience_years: row.experience_years,
        owner_id: row.owner_id,
        linkedin_url: row.linkedin_url,
      } as never)
      .select("*")
      .single();

    if (error) {
      throw new CandidatesRepositoryError("Kandidaat kon niet worden aangemaakt.");
    }

    return mapCandidateRowToDomain(data);
  }
}
