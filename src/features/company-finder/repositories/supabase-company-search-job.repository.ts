import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyFinderCriteria,
  CompanySearchJob,
  CompanySearchJobStatus,
} from "@/features/company-finder/domain";
import type {
  CompanySearchJobRepository,
  CreateCompanySearchJobInput,
  UpdateCompanySearchJobInput,
} from "@/features/company-finder/repositories/company-search-job.repository";
import { CompanySearchJobRepositoryError } from "@/features/company-finder/repositories/errors";
import { logSupabaseError } from "@/lib/supabase/log-error";

type CompanySearchJobRow = {
  id: string;
  organization_id: string;
  user_id: string;
  status: CompanySearchJobStatus;
  criteria: CompanyFinderCriteria;
  found_count: number;
  saved_count: number;
  updated_count?: number;
  skipped_count: number;
  error_count?: number;
  provider_errors?: Array<{ provider: string; message: string }> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: CompanySearchJobRow): CompanySearchJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    status: row.status,
    criteria: row.criteria,
    foundCount: row.found_count,
    savedCount: row.saved_count,
    updatedCount: row.updated_count ?? 0,
    skippedCount: row.skipped_count,
    errorCount: row.error_count ?? 0,
    providerErrors: row.provider_errors ?? [],
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseCompanySearchJobRepository implements CompanySearchJobRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: CreateCompanySearchJobInput): Promise<CompanySearchJob> {
    const { data, error } = await this.client
      .from("company_search_jobs")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        criteria: input.criteria,
        status: "queued",
      })
      .select("*")
      .single();

    if (error || !data) {
      logSupabaseError({
        operation: "company_search_jobs.create",
        repository: "SupabaseCompanySearchJobRepository",
        organizationId: input.organizationId,
        userId: input.userId,
        error,
      });
      throw new CompanySearchJobRepositoryError(
        "Zoekjob kon niet worden aangemaakt.",
        error,
      );
    }

    return mapRow(data as CompanySearchJobRow);
  }

  async findById(organizationId: string, jobId: string): Promise<CompanySearchJob | null> {
    const { data, error } = await this.client
      .from("company_search_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      logSupabaseError({
        operation: "company_search_jobs.findById",
        repository: "SupabaseCompanySearchJobRepository",
        organizationId,
        error,
      });
      throw new CompanySearchJobRepositoryError("Zoekjob kon niet worden opgehaald.", error);
    }

    if (!data) {
      return null;
    }

    return mapRow(data as CompanySearchJobRow);
  }

  async update(
    organizationId: string,
    jobId: string,
    input: UpdateCompanySearchJobInput,
  ): Promise<CompanySearchJob> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status !== undefined) updates.status = input.status;
    if (input.foundCount !== undefined) updates.found_count = input.foundCount;
    if (input.savedCount !== undefined) updates.saved_count = input.savedCount;
    if (input.updatedCount !== undefined) updates.updated_count = input.updatedCount;
    if (input.skippedCount !== undefined) updates.skipped_count = input.skippedCount;
    if (input.errorCount !== undefined) updates.error_count = input.errorCount;
    if (input.providerErrors !== undefined) updates.provider_errors = input.providerErrors;
    if (input.errorMessage !== undefined) updates.error_message = input.errorMessage;

    const { data, error } = await this.client
      .from("company_search_jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (error || !data) {
      logSupabaseError({
        operation: "company_search_jobs.update",
        repository: "SupabaseCompanySearchJobRepository",
        organizationId,
        error,
      });
      throw new CompanySearchJobRepositoryError("Zoekjob kon niet worden bijgewerkt.", error);
    }

    return mapRow(data as CompanySearchJobRow);
  }
}
