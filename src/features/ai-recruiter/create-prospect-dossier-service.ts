import { createClient } from "@/lib/supabase/server";
import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { ProspectDossierService } from "@/features/ai-recruiter/services/prospect-dossier.service";

export async function createProspectDossierService(): Promise<ProspectDossierService> {
  const client = await createClient();
  const repository = await createAiRecruiterRepository();
  return new ProspectDossierService(repository, client);
}
