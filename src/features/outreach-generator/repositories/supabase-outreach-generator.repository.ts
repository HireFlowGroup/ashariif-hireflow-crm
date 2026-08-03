import type { SupabaseClient } from "@supabase/supabase-js";

import { parseOutreachGeneratorContent } from "@/features/outreach-generator/domain/generator.schema";
import type {
  OutreachGeneratorRecord,
  OutreachWritingStyle,
} from "@/features/outreach-generator/domain/generator.types";
import {
  OutreachGeneratorRepositoryError,
  type OutreachGeneratorRepository,
  type SaveOutreachGenerationInput,
} from "@/features/outreach-generator/repositories/outreach-generator.repository";
import type { Database } from "@/types/database";
import type { OutreachGenerationRow } from "@/types/hiring-intelligence";

export const OUTREACH_GENERATOR_MODEL_VERSION = "outreach-generator-v1";

function mapRow(row: OutreachGenerationRow): OutreachGeneratorRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    writingStyle: row.writing_style,
    contactId: row.contact_id,
    contactName: row.contact_name,
    primarySignalId: row.primary_signal_id,
    content: parseOutreachGeneratorContent(row.content),
    referencedSignalIds: row.referenced_signal_ids,
    model: row.model,
    generatedAt: row.generated_at,
  };
}

export class SupabaseOutreachGeneratorRepository implements OutreachGeneratorRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getCurrent(
    organizationId: string,
    companyId: string,
    writingStyle: OutreachWritingStyle,
  ): Promise<OutreachGeneratorRecord | null> {
    const { data, error } = await this.client
      .from("outreach_generations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("writing_style", writingStyle)
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      throw new OutreachGeneratorRepositoryError(error.message);
    }

    if (!data) return null;

    return mapRow(data as OutreachGenerationRow);
  }

  async listCurrentByCompany(
    organizationId: string,
    companyId: string,
  ): Promise<OutreachGeneratorRecord[]> {
    const { data, error } = await this.client
      .from("outreach_generations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("is_current", true)
      .order("generated_at", { ascending: false });

    if (error) {
      throw new OutreachGeneratorRepositoryError(error.message);
    }

    return ((data ?? []) as OutreachGenerationRow[]).map(mapRow);
  }

  async save(input: SaveOutreachGenerationInput): Promise<OutreachGeneratorRecord> {
    await this.client
      .from("outreach_generations")
      .update({ is_current: false } as never)
      .eq("organization_id", input.organizationId)
      .eq("company_id", input.companyId)
      .eq("writing_style", input.writingStyle)
      .eq("is_current", true);

    const { data, error } = await this.client
      .from("outreach_generations")
      .insert({
        organization_id: input.organizationId,
        company_id: input.companyId,
        user_id: input.userId,
        writing_style: input.writingStyle,
        contact_id: input.contactId,
        contact_name: input.contactName,
        primary_signal_id: input.primarySignalId,
        content: input.content as never,
        referenced_signal_ids: input.referencedSignalIds,
        model: input.model,
        model_version: input.modelVersion,
        is_current: true,
      } as never)
      .select("*")
      .single();

    if (error || !data) {
      throw new OutreachGeneratorRepositoryError(error?.message ?? "Outreach opslaan mislukt.");
    }

    return mapRow(data as OutreachGenerationRow);
  }
}
