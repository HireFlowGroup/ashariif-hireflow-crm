import { createClient } from "@/lib/supabase/server";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { createCompanyFinderService } from "@/features/company-finder/create-company-finder-service";
import { createContactFinderService } from "@/features/contact-finder/create-contact-finder-service";
import { SupabaseAiRecruiterRepository } from "@/features/ai-recruiter/repositories/supabase-ai-recruiter.repository";
import { AiRecruiterOrchestrator } from "@/features/ai-recruiter/services/ai-recruiter-orchestrator.service";
import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";

export async function createAiRecruiterOrchestrator(): Promise<AiRecruiterOrchestrator> {
  const authClient = await createClient();
  const repository = new SupabaseAiRecruiterRepository(authClient);
  const companyFinder = await createCompanyFinderService();
  const contactFinder = await createContactFinderService();
  const companiesService = await createCompaniesServiceWithWriteClient(authClient);
  const outreachEngine = await createOutreachEngineService();

  return new AiRecruiterOrchestrator(
    repository,
    companyFinder,
    contactFinder,
    companiesService,
    outreachEngine,
    authClient,
  );
}
