import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateVacancyInput,
  ListVacanciesInput,
  SearchVacanciesInput,
  UpdateVacancyInput,
  Vacancy,
  VacancyId,
} from "@/features/vacancies/domain";
import type { VacanciesRepository } from "@/features/vacancies/repositories/vacancies.repository";
import {
  mapCreateInputToRow,
  mapUpdateInputToRow,
  mapVacancyIdToString,
  mapVacancyRowToDomain,
} from "@/features/vacancies/repositories/vacancy.mapper";
import { VacanciesRepositoryError } from "@/features/vacancies/repositories/errors";
import { escapeIlikePattern } from "@/features/companies/repositories/search-utils";
import type { Database } from "@/types/database";

/**
 * Supabase-backed vacancies repository.
 * SQL/RLS access only — business rules belong in the service layer.
 */
export class SupabaseVacanciesRepository implements VacanciesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(organizationId: string, input: CreateVacancyInput): Promise<Vacancy> {
    const row = mapCreateInputToRow(organizationId, {
      companyId: input.companyId as string,
      ownerId: input.ownerId ?? null,
      title: input.title,
      description: input.description,
      location: input.location,
      employmentType: input.employmentType,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      status: input.status,
      requirements: input.requirements,
    });

    const { data, error } = await this.client
      .from("vacancies")
      .insert(row)
      .select("*")
      .single();

    if (error || !data) {
      throw new VacanciesRepositoryError("Vacature kon niet worden opgeslagen.");
    }

    return mapVacancyRowToDomain(data);
  }

  async update(
    organizationId: string,
    vacancyId: VacancyId,
    input: UpdateVacancyInput,
  ): Promise<Vacancy> {
    const updates = mapUpdateInputToRow({
      companyId: input.companyId ? (input.companyId as string) : undefined,
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
      location: input.location,
      employmentType: input.employmentType,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      status: input.status,
      requirements: input.requirements,
    });

    if (Object.keys(updates).length === 0) {
      throw new VacanciesRepositoryError("Geen geldige updatevelden opgegeven.");
    }

    const { data, error } = await this.client
      .from("vacancies")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", mapVacancyIdToString(vacancyId))
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new VacanciesRepositoryError("Vacature kon niet worden bijgewerkt.");
    }

    if (!data) {
      throw new VacanciesRepositoryError("Vacature niet gevonden.");
    }

    return mapVacancyRowToDomain(data);
  }

  async findById(organizationId: string, vacancyId: VacancyId): Promise<Vacancy | null> {
    const { data, error } = await this.client
      .from("vacancies")
      .select("*")
      .eq("id", mapVacancyIdToString(vacancyId))
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      throw new VacanciesRepositoryError("Vacature kon niet worden opgehaald.");
    }

    if (!data) {
      return null;
    }

    return mapVacancyRowToDomain(data);
  }

  async search(organizationId: string, input: SearchVacanciesInput): Promise<Vacancy[]> {
    const limit = input.limit ?? 20;

    let query = this.client
      .from("vacancies")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (input.archived === true || input.status === "closed") {
      query = query.eq("status", "closed");
    } else if (input.archived === false) {
      query = query.neq("status", "closed");
    } else if (
      input.status === "draft" ||
      input.status === "open" ||
      input.status === "on_hold"
    ) {
      query = query.eq("status", input.status);
    }

    if (input.companyId) {
      query = query.eq("company_id", input.companyId as string);
    }

    if (input.employmentType) {
      query = query.eq("employment_type", input.employmentType);
    }

    const locationTerm = input.location?.trim();
    if (locationTerm) {
      query = query.ilike("location", `%${escapeIlikePattern(locationTerm)}%`);
    }

    const searchTerm = input.query?.trim();
    if (searchTerm) {
      const pattern = `%${escapeIlikePattern(searchTerm)}%`;
      query = query.or(
        [
          `title.ilike.${pattern}`,
          `description.ilike.${pattern}`,
          `location.ilike.${pattern}`,
          `requirements.ilike.${pattern}`,
        ].join(","),
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new VacanciesRepositoryError("Vacatures konden niet worden gezocht.");
    }

    return (data ?? []).map((row) => mapVacancyRowToDomain(row));
  }

  async list(
    organizationId: string,
    input: ListVacanciesInput,
  ): Promise<{ vacancies: Vacancy[]; total: number }> {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const includeArchived = input.includeArchived ?? false;

    const applyFilters = <
      T extends {
        eq: (column: string, value: string) => T;
        neq: (column: string, value: string) => T;
      },
    >(
      builder: T,
    ): T => {
      let next = builder;

      if (!includeArchived) {
        next = next.neq("status", "closed");
      }

      if (input.companyId) {
        next = next.eq("company_id", input.companyId as string);
      }

      return next;
    };

    let countQuery = this.client
      .from("vacancies")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    countQuery = applyFilters(countQuery);

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new VacanciesRepositoryError("Vacatures konden niet worden geteld.");
    }

    let dataQuery = this.client
      .from("vacancies")
      .select("*")
      .eq("organization_id", organizationId)
      .order("title", { ascending: true })
      .range(offset, offset + limit - 1);

    dataQuery = applyFilters(dataQuery);

    const { data, error } = await dataQuery;

    if (error) {
      throw new VacanciesRepositoryError("Vacatures konden niet worden opgehaald.");
    }

    const vacancies = (data ?? []).map((row) => mapVacancyRowToDomain(row));

    return {
      vacancies,
      total: count ?? vacancies.length,
    };
  }

  async archive(organizationId: string, vacancyId: VacancyId): Promise<Vacancy> {
    const { data, error } = await this.client
      .from("vacancies")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", mapVacancyIdToString(vacancyId))
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new VacanciesRepositoryError("Vacature kon niet worden gearchiveerd.");
    }

    if (!data) {
      throw new VacanciesRepositoryError("Vacature niet gevonden.");
    }

    return mapVacancyRowToDomain(data);
  }
}
