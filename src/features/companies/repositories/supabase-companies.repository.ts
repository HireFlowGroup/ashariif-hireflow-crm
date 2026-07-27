import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Company,
  CompanyId,
  CreateCompanyInput,
  ListCompaniesInput,
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
import { escapeIlikePattern } from "@/features/companies/repositories/search-utils";
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

    if (error) {
      throw new CompaniesRepositoryError("Bedrijf kon niet worden bijgewerkt.");
    }

    if (!data) {
      throw new CompaniesRepositoryError("Bedrijf niet gevonden.");
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

    if (input.archived === true || input.status === "archived") {
      query = query.eq("status", "inactive");
    } else if (input.archived === false) {
      query = query.neq("status", "inactive");
    } else if (
      input.status === "active" ||
      input.status === "inactive" ||
      input.status === "prospect"
    ) {
      query = query.eq("status", input.status);
    }

    if (input.priority) {
      void input.priority;
    }

    const sectorTerm = input.sector?.trim();
    if (sectorTerm) {
      query = query.ilike("industry", `%${escapeIlikePattern(sectorTerm)}%`);
    }

    const searchTerm = input.query?.trim();
    if (searchTerm) {
      const pattern = `%${escapeIlikePattern(searchTerm)}%`;
      query = query.or(
        [`name.ilike.${pattern}`, `website.ilike.${pattern}`, `industry.ilike.${pattern}`].join(
          ",",
        ),
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new CompaniesRepositoryError("Bedrijven konden niet worden gezocht.");
    }

    let companies = (data ?? []).map((row) => mapCompanyRowToDomain(row, null));

    const cityTerm = input.city?.trim().toLowerCase();
    if (cityTerm) {
      companies = companies.filter((company) =>
        company.city?.toLowerCase().includes(cityTerm),
      );
    }

    return companies;
  }

  async list(
    organizationId: string,
    input: ListCompaniesInput,
  ): Promise<{ companies: Company[]; total: number }> {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const includeArchived = input.includeArchived ?? false;

    const applyStatusFilter = <T extends { neq: (column: string, value: string) => T }>(
      builder: T,
    ): T => {
      if (includeArchived) {
        return builder;
      }

      return builder.neq("status", "inactive");
    };

    let countQuery = this.client
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    countQuery = applyStatusFilter(countQuery);

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new CompaniesRepositoryError("Bedrijven konden niet worden geteld.");
    }

    let dataQuery = this.client
      .from("companies")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    dataQuery = applyStatusFilter(dataQuery);

    const { data, error } = await dataQuery;

    if (error) {
      throw new CompaniesRepositoryError("Bedrijven konden niet worden opgehaald.");
    }

    const companies = (data ?? []).map((row) => mapCompanyRowToDomain(row, null));

    return {
      companies,
      total: count ?? companies.length,
    };
  }

  async archive(organizationId: string, companyId: CompanyId): Promise<Company> {
    const { data, error } = await this.client
      .from("companies")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", mapCompanyIdToString(companyId))
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new CompaniesRepositoryError("Bedrijf kon niet worden gearchiveerd.");
    }

    if (!data) {
      throw new CompaniesRepositoryError("Bedrijf niet gevonden.");
    }

    return mapCompanyRowToDomain(data, null);
  }

  async delete(organizationId: string, companyId: CompanyId): Promise<Company> {
    const { data, error } = await this.client
      .from("companies")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", mapCompanyIdToString(companyId))
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new CompaniesRepositoryError("Bedrijf kon niet worden verwijderd.");
    }

    if (!data) {
      throw new CompaniesRepositoryError("Bedrijf niet gevonden.");
    }

    return mapCompanyRowToDomain(data, null);
  }
}
