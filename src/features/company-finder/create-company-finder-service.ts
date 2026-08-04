import { createClient } from "@/lib/supabase/server";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { CompanyFinderService } from "@/features/company-finder/services/company-finder.service";
import { SupabaseCompanySearchJobRepository } from "@/features/company-finder/repositories";

export async function createCompanyFinderService(): Promise<CompanyFinderService> {
  const authClient = await createClient();

  // Warm JWT on the session-bound client (required for job RLS: user_id = auth.uid()).
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    throw new Error("Geen actieve Supabase-sessie voor Company Finder.");
  }

  const companiesService = await createCompaniesServiceWithWriteClient(authClient);

  return new CompanyFinderService(
    new SupabaseCompanySearchJobRepository(authClient),
    companiesService,
  );
}
