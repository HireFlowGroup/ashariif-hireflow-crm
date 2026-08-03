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
  mapBareDiscoveryCreateInputToRow,
  mapCompanyIdToString,
  mapCompanyRowToDomain,
  mapCreateInputToRow,
  mapDiscoveryCreateInputToRow,
  mapUpdateInputToRow,
} from "@/features/companies/repositories/company.mapper";
import { CompaniesRepositoryError } from "@/features/companies/repositories/errors";
import { escapeIlikePattern } from "@/features/companies/repositories/search-utils";
import { logSupabaseError } from "@/lib/supabase/log-error";
import type { Database } from "@/types/database";
import type { Company as CompanyRow } from "@/types/crm";

/**
 * Supabase-backed companies repository.
 * SQL/RLS access only — business rules belong in the service layer.
 */
export class SupabaseCompaniesRepository implements CompaniesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private logError(
    operation: string,
    organizationId: string,
    error: { code?: string; message?: string; details?: string; hint?: string } | null,
  ): void {
    logSupabaseError({
      operation,
      repository: "SupabaseCompaniesRepository",
      organizationId,
      error: error as never,
    });
  }

  private mapRowsSafely(
    rows: CompanyRow[],
    organizationId: string,
  ): Company[] {
    const companies: Company[] = [];

    for (const row of rows) {
      try {
        companies.push(mapCompanyRowToDomain(row, null));
      } catch (error) {
        this.logError("companies.map", organizationId, {
          message: error instanceof Error ? error.message : "Mapping mislukt",
        });
      }
    }

    return companies;
  }

  async create(organizationId: string, input: CreateCompanyInput): Promise<Company> {
    return this.insertCompanyRow(organizationId, mapCreateInputToRow(organizationId, input), input.ownerId ?? null);
  }

  async createDiscovery(organizationId: string, input: CreateCompanyInput): Promise<Company> {
    const discoveryRow = mapDiscoveryCreateInputToRow(organizationId, input);

    try {
      return await this.insertCompanyRow(organizationId, discoveryRow, input.ownerId ?? null);
    } catch (error) {
      const code = error instanceof CompaniesRepositoryError ? error.supabaseCode : undefined;
      const isSchemaMismatch =
        code === "42703" || code === "PGRST204" || code === "PGRST205";

      if (!isSchemaMismatch) {
        throw error;
      }

      console.warn("[CompaniesRepository] Discovery insert fallback naar minimale kolommen", {
        organizationId,
        name: input.name,
        supabaseCode: code,
      });

      return this.insertCompanyRow(
        organizationId,
        mapBareDiscoveryCreateInputToRow(organizationId, input),
        input.ownerId ?? null,
      );
    }
  }

  private async insertCompanyRow(
    organizationId: string,
    row: Record<string, unknown>,
    ownerId: string | null,
  ): Promise<Company> {
    const { data, error } = await this.client
      .from("companies")
      .insert(row as never)
      .select("*")
      .single();

    if (error || !data) {
      this.logError("companies.create", organizationId, error);
      throw new CompaniesRepositoryError(
        error?.message ?? "Bedrijf kon niet worden opgeslagen.",
        error,
      );
    }

    return mapCompanyRowToDomain(data, ownerId);
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
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
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
      const pattern = `%${escapeIlikePattern(sectorTerm)}%`;
      query = query.or(
        [`sector.ilike.${pattern}`, `industry.ilike.${pattern}`].join(","),
      );
    }

    const searchTerm = input.query?.trim();
    if (searchTerm) {
      const pattern = `%${escapeIlikePattern(searchTerm)}%`;
      query = query.or(
        [
          `name.ilike.${pattern}`,
          `website.ilike.${pattern}`,
          `sector.ilike.${pattern}`,
          `industry.ilike.${pattern}`,
        ].join(","),
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

    let dataQuery = this.client
      .from("companies")
      .select("*")
      .eq("organization_id", organizationId)
      .order("lead_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeArchived) {
      dataQuery = dataQuery.neq("status", "inactive");
    }

    if (input.leadPriority) {
      dataQuery = dataQuery.eq("priority", input.leadPriority);
    }

    if (input.hasVacancies) {
      dataQuery = dataQuery.gt("vacancy_count", 0);
    }

    if (input.outreachReady) {
      dataQuery = dataQuery
        .gte("lead_score", 50)
        .in("outreach_status", ["none", "draft"]);
    }

    const { data, error } = await dataQuery;

    if (error) {
      this.logError("companies.list.data", organizationId, error);
      throw new CompaniesRepositoryError("Bedrijven konden niet worden opgehaald.", error);
    }

    const companies = this.mapRowsSafely((data ?? []) as CompanyRow[], organizationId);

    let countQuery = this.client
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    if (!includeArchived) {
      countQuery = countQuery.neq("status", "inactive");
    }

    if (input.leadPriority) {
      countQuery = countQuery.eq("priority", input.leadPriority);
    }

    if (input.hasVacancies) {
      countQuery = countQuery.gt("vacancy_count", 0);
    }

    if (input.outreachReady) {
      countQuery = countQuery
        .gte("lead_score", 50)
        .in("outreach_status", ["none", "draft"]);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      this.logError("companies.list.count", organizationId, countError);
    }

    return {
      companies,
      total: countError ? companies.length : (count ?? companies.length),
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
