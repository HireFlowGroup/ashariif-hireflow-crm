import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isCommercialPipelineStage,
  type CommercialPipelineCard,
  type CreatePipelineCardInput,
  type MovePipelineCardInput,
} from "@/features/commercial-pipeline/domain/types";
import { CommercialPipelineRepositoryError } from "@/features/commercial-pipeline/repositories/commercial-pipeline.repository";
import type { CommercialPipelineRepository } from "@/features/commercial-pipeline/repositories/commercial-pipeline.repository";
import type { Database } from "@/types/database";

type PipelineCardRow = Database["public"]["Tables"]["commercial_pipeline_cards"]["Row"];

function mapRow(row: PipelineCardRow): CommercialPipelineCard {
  if (!isCommercialPipelineStage(row.stage)) {
    throw new CommercialPipelineRepositoryError(`Ongeldige pipeline-fase: ${row.stage}`);
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    stage: row.stage,
    position: row.position,
    companyName: row.company_name,
    sector: row.sector,
    city: row.city,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    leadScore: row.lead_score,
    dealValue: row.deal_value ? Number(row.deal_value) : null,
    notes: row.notes,
    sourceRunItemId: row.source_run_item_id,
    lostReason: row.lost_reason,
    movedAt: row.moved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseCommercialPipelineRepository implements CommercialPipelineRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listCards(organizationId: string): Promise<CommercialPipelineCard[]> {
    const { data, error } = await this.client
      .from("commercial_pipeline_cards")
      .select("*")
      .eq("organization_id", organizationId)
      .order("stage")
      .order("position");

    if (error) throw new CommercialPipelineRepositoryError(error.message);

    return (data ?? []).map(mapRow);
  }

  async getCard(organizationId: string, cardId: string): Promise<CommercialPipelineCard | null> {
    const { data, error } = await this.client
      .from("commercial_pipeline_cards")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", cardId)
      .maybeSingle();

    if (error) throw new CommercialPipelineRepositoryError(error.message);
    if (!data) return null;

    return mapRow(data);
  }

  async createCard(
    organizationId: string,
    input: CreatePipelineCardInput & {
      companyName: string;
      sector: string | null;
      city: string | null;
      contactName: string | null;
      contactEmail: string | null;
      leadScore: number | null;
    },
  ): Promise<CommercialPipelineCard> {
    const stage = input.stage ?? "nieuw";

    const { data: maxPositionRow } = await this.client
      .from("commercial_pipeline_cards")
      .select("position")
      .eq("organization_id", organizationId)
      .eq("stage", stage)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (maxPositionRow?.position ?? -1) + 1;
    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from("commercial_pipeline_cards")
      .insert({
        organization_id: organizationId,
        company_id: input.companyId,
        stage,
        position,
        company_name: input.companyName,
        sector: input.sector,
        city: input.city,
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        lead_score: input.leadScore,
        source_run_item_id: input.sourceRunItemId ?? null,
        moved_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) throw new CommercialPipelineRepositoryError(error.message);

    return mapRow(data);
  }

  async moveCard(
    organizationId: string,
    cardId: string,
    input: MovePipelineCardInput,
  ): Promise<CommercialPipelineCard> {
    const existing = await this.getCard(organizationId, cardId);
    if (!existing) {
      throw new CommercialPipelineRepositoryError("Pipeline-kaart niet gevonden.");
    }

    let position = input.position;

    if (position === undefined) {
      const { data: maxPositionRow } = await this.client
        .from("commercial_pipeline_cards")
        .select("position")
        .eq("organization_id", organizationId)
        .eq("stage", input.stage)
        .neq("id", cardId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      position = (maxPositionRow?.position ?? -1) + 1;
    }

    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from("commercial_pipeline_cards")
      .update({
        stage: input.stage,
        position,
        moved_at: now,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", cardId)
      .select("*")
      .single();

    if (error) throw new CommercialPipelineRepositoryError(error.message);

    return mapRow(data);
  }

  async syncCompaniesWithoutCards(organizationId: string): Promise<number> {
    const { data: companies, error: companiesError } = await this.client
      .from("companies")
      .select("id, name, sector, city, lead_score, general_email, hr_email")
      .eq("organization_id", organizationId)
      .order("name");

    if (companiesError) throw new CommercialPipelineRepositoryError(companiesError.message);

    const { data: existingCards, error: cardsError } = await this.client
      .from("commercial_pipeline_cards")
      .select("company_id")
      .eq("organization_id", organizationId);

    if (cardsError) throw new CommercialPipelineRepositoryError(cardsError.message);

    const existingCompanyIds = new Set((existingCards ?? []).map((c) => c.company_id));
    const missing = (companies ?? []).filter((c) => !existingCompanyIds.has(c.id));

    if (missing.length === 0) return 0;

    const now = new Date().toISOString();
    let position = 0;

    const { data: maxPositionRow } = await this.client
      .from("commercial_pipeline_cards")
      .select("position")
      .eq("organization_id", organizationId)
      .eq("stage", "nieuw")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    position = (maxPositionRow?.position ?? -1) + 1;

    const rows = missing.map((company, index) => ({
      organization_id: organizationId,
      company_id: company.id,
      stage: "nieuw" as const,
      position: position + index,
      company_name: company.name,
      sector: company.sector,
      city: company.city,
      contact_name: null,
      contact_email: company.hr_email ?? company.general_email ?? null,
      lead_score: company.lead_score,
      moved_at: now,
      updated_at: now,
    }));

    const { error: insertError } = await this.client
      .from("commercial_pipeline_cards")
      .insert(rows);

    if (insertError) throw new CommercialPipelineRepositoryError(insertError.message);

    return missing.length;
  }
}
