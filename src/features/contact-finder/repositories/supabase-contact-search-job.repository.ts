import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContactFinderCriteria,
  ContactSearchJob,
  ContactSearchJobStatus,
} from "@/features/contact-finder/domain";
import type {
  ContactSearchJobRepository,
  CreateContactSearchJobInput,
  UpdateContactSearchJobInput,
} from "@/features/contact-finder/repositories/contact-search-job.repository";
import { ContactSearchJobRepositoryError } from "@/features/contact-finder/repositories/errors";

type ContactSearchJobRow = {
  id: string;
  organization_id: string;
  user_id: string;
  company_id: string;
  status: ContactSearchJobStatus;
  criteria: ContactFinderCriteria;
  found_count: number;
  saved_count: number;
  skipped_count: number;
  error_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ContactSearchJobRow): ContactSearchJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    companyId: row.company_id,
    status: row.status,
    criteria: row.criteria,
    foundCount: row.found_count,
    savedCount: row.saved_count,
    skippedCount: row.skipped_count,
    errorCount: row.error_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseContactSearchJobRepository implements ContactSearchJobRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: CreateContactSearchJobInput): Promise<ContactSearchJob> {
    const { data, error } = await this.client
      .from("contact_search_jobs")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        company_id: input.companyId,
        criteria: input.criteria,
        status: "pending",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new ContactSearchJobRepositoryError("Zoekjob kon niet worden aangemaakt.");
    }

    return mapRow(data as ContactSearchJobRow);
  }

  async findById(organizationId: string, jobId: string): Promise<ContactSearchJob | null> {
    const { data, error } = await this.client
      .from("contact_search_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      throw new ContactSearchJobRepositoryError("Zoekjob kon niet worden opgehaald.");
    }

    if (!data) {
      return null;
    }

    return mapRow(data as ContactSearchJobRow);
  }

  async update(
    organizationId: string,
    jobId: string,
    input: UpdateContactSearchJobInput,
  ): Promise<ContactSearchJob> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status !== undefined) {
      updates.status = input.status;
    }

    if (input.foundCount !== undefined) {
      updates.found_count = input.foundCount;
    }

    if (input.savedCount !== undefined) {
      updates.saved_count = input.savedCount;
    }

    if (input.skippedCount !== undefined) {
      updates.skipped_count = input.skippedCount;
    }

    if (input.errorCount !== undefined) {
      updates.error_count = input.errorCount;
    }

    if (input.errorMessage !== undefined) {
      updates.error_message = input.errorMessage;
    }

    const { data, error } = await this.client
      .from("contact_search_jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (error || !data) {
      throw new ContactSearchJobRepositoryError("Zoekjob kon niet worden bijgewerkt.");
    }

    return mapRow(data as ContactSearchJobRow);
  }
}
