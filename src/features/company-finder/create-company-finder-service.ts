import { createClient } from "@/lib/supabase/server";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import { CompanyFinderService } from "@/features/company-finder/services/company-finder.service";
import { SupabaseCompanySearchJobRepository } from "@/features/company-finder/repositories";

export async function createCompanyFinderService(): Promise<CompanyFinderService> {
  const client = await createClient();
  const companiesService = await createCompaniesService();

  return new CompanyFinderService(
    new SupabaseCompanySearchJobRepository(client),
    companiesService,
  );
}
