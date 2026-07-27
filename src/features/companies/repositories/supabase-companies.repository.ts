import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "@/features/companies/domain";
import type { CompaniesRepository } from "@/features/companies/repositories/companies.repository";
import type { Database } from "@/types/database";

/**
 * Supabase-backed companies repository.
 * SQL/RLS access only — business rules belong in the service layer.
 */
export class SupabaseCompaniesRepository implements CompaniesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(
    ...args: Parameters<CompaniesRepository["create"]>
  ): Promise<Company> {
    void args;
    void this.client;
    throw new Error("Not implemented");
  }

  async update(
    ...args: Parameters<CompaniesRepository["update"]>
  ): Promise<Company> {
    void args;
    void this.client;
    throw new Error("Not implemented");
  }

  async findById(
    ...args: Parameters<CompaniesRepository["findById"]>
  ): Promise<Company | null> {
    void args;
    void this.client;
    throw new Error("Not implemented");
  }

  async search(
    ...args: Parameters<CompaniesRepository["search"]>
  ): Promise<Company[]> {
    void args;
    void this.client;
    throw new Error("Not implemented");
  }

  async archive(
    ...args: Parameters<CompaniesRepository["archive"]>
  ): Promise<Company> {
    void args;
    void this.client;
    throw new Error("Not implemented");
  }
}
