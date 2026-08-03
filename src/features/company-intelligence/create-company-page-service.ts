import { CompanyPageService } from "@/features/company-intelligence/services/company-page.service";
import { SupabaseCompanyPageRepository } from "@/features/company-intelligence/repositories/supabase-company-page.repository";
import { createClient } from "@/lib/supabase/server";

export async function createCompanyPageService(): Promise<CompanyPageService> {
  const client = await createClient();
  return new CompanyPageService(new SupabaseCompanyPageRepository(client));
}
