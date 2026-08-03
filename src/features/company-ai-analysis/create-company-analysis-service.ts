import { CompanyAnalysisService } from "@/features/company-ai-analysis/services/company-analysis.service";
import { SupabaseCompanyAnalysisRepository } from "@/features/company-ai-analysis/repositories/supabase-company-analysis.repository";
import { createClient } from "@/lib/supabase/server";

export async function createCompanyAnalysisService(): Promise<CompanyAnalysisService> {
  const client = await createClient();
  return new CompanyAnalysisService(new SupabaseCompanyAnalysisRepository(client));
}
