import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Company,
  CompanyId,
  CreateCompanyInput,
  SearchCompaniesInput,
  UpdateCompanyInput,
} from "@/features/companies/domain";
import type { CompaniesRepository } from "@/features/companies/repositories/companies.repository";
import {
  mapCompanyIdToString,
  mapCompanyRowToDomain,
  mapCreateInputToRow,
  mapUpdateInputToRow,
} from "@/features/companies/repositories/company.mapper";
import { CompaniesRepositoryError } from "@/features/companies/repositories/errors";
import type { Database } from "@/types/database";

/**
 * Supabase-backed companies repository.
 * SQL/RLS access only — business rules belong in the service layer.
 */
export class SupabaseCompaniesRepository implements CompaniesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(organizationId: string, input: CreateCompanyInput): Promise<Company> {
    const row = mapCreateInputToRow(organizationId, input);

    const { data, error } = await this.client
      .from("companies")
      .insert(row)
      .select("*")
      .single();

    if (error || !data) {
      throw new CompaniesRepositoryError("Bedrijf kon niet worden opgeslagen.");
    }

    return mapCompanyRowToDomain(data, input.ownerId ?? null);
  }

  async update(
    organizationId: string,
    companyId: CompanyId,
    input: UpdateCompanyInput,
  ): Promise<Company> {
    const updates = mapUpdateInputToRow(input);

    if (Object.keys(updates).length === 0) {
      throw new CompaniesRepositoryError("Geen geldige updatevelden opgegeven.");
    }

    const { data, error } = await this.client
      .from("companies")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", mapCompanyIdToString(companyId))
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      throw new CompaniesRepositoryError("Bedrijf kon niet worden bijgewerkt.");
    }

    return mapCompanyRowToDomain(data, null);
  }

  async findById(organizationId: string, companyId: CompanyId): Promise<Company | null> {
    const { data, error } = await this.client
      .from("companies")
      .select("*")
      .eq("id", mapCompanyIdToString(companyId))
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      throw new CompaniesRepositoryError("Bedrijf kon niet worden opgehaald.");
    }

    if (!data) {
      return null;
    }

    return mapCompanyRowToDomain(data, null);
  }

  async search(organizationId: string, input: SearchCompaniesInput): Promise<Company[]> {
    const limit = input.limit ?? 20;

    let query = this.client
      .from("companies")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (input.status && input.status !== "archived") {
      query = query.eq("status", input.status);
    }

    if (input.status === "archived") {
      query = query.eq("status", "inactive");
    }

    if (input.query?.trim()) {
      query = query.ilike("name", `%${input.query.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new CompaniesRepositoryError("Bedrijven konden niet worden gezocht.");
    }

    return (data ?? []).map((row) => mapCompanyRowToDomain(row, null));
  }

  async archive(organizationId: string, companyId: CompanyId): Promise<Company> {
    const { data, error } = await this.client
      .from("companies")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", mapCompanyIdToString(companyId))
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      throw new CompaniesRepositoryError("Bedrijf kon niet worden gearchiveerd.");
    }

    return mapCompanyRowToDomain(data, null);
  }
}
