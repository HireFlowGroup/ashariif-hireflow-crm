import { createClient } from "@/lib/supabase/server";
import { createCompaniesService, createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { createEmailProvider } from "@/features/outreach-engine/email/create-email-provider";
import { SupabaseOutreachEngineRepository } from "@/features/outreach-engine/repositories/supabase-outreach-engine.repository";
import { OutreachEngine } from "@/features/outreach-engine/services/outreach-engine.service";

export async function createOutreachEngineService(): Promise<OutreachEngine> {
  const authClient = await createClient();
  const companiesService = await createCompaniesServiceWithWriteClient(authClient);
  const repository = new SupabaseOutreachEngineRepository(authClient);
  const emailProvider = createEmailProvider();

  return new OutreachEngine(repository, companiesService, emailProvider, authClient);
}
