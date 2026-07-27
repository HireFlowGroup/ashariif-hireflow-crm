import { CompaniesService } from "@/features/companies/services/companies.service";
import { SupabaseCompaniesRepository } from "@/features/companies/repositories/supabase-companies.repository";
import { createClient } from "@/lib/supabase/server";

/** Server-side factory for the companies application service. */
export async function createCompaniesService(): Promise<CompaniesService> {
  const client = await createClient();
  return new CompaniesService(new SupabaseCompaniesRepository(client));
}
