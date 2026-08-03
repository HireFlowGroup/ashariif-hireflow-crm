import type { SupabaseClient } from "@supabase/supabase-js";

import { CompaniesService } from "@/features/companies/services/companies.service";
import { SupabaseCompaniesRepository } from "@/features/companies/repositories/supabase-companies.repository";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export function createCompaniesServiceFromClient(
  client: SupabaseClient<Database>,
): CompaniesService {
  return new CompaniesService(new SupabaseCompaniesRepository(client));
}

/** Server-side factory for the companies application service. */
export async function createCompaniesService(): Promise<CompaniesService> {
  const client = await createClient();
  return createCompaniesServiceFromClient(client);
}
