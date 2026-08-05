import { createClient } from "@/lib/supabase/server";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { createCompanyFinderService } from "@/features/company-finder/create-company-finder-service";
import { createContactFinderService } from "@/features/contact-finder/create-contact-finder-service";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import type {
  AiRecruiterEngineContext,
  AiRecruiterRun,
  CreateAiRecruiterRunInput,
} from "@/features/ai-recruiter/domain/types";
import { aiRecruiterRunSettingsSchema } from "@/features/ai-recruiter/domain/types";
import { SupabaseAiRecruiterRepository } from "@/features/ai-recruiter/repositories/supabase-ai-recruiter.repository";
import { AiRecruiterOrchestrator } from "@/features/ai-recruiter/services/ai-recruiter-orchestrator.service";
import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";

/** Lightweight accessor for list/get/create — avoids spinning up finder engines. */
export async function createAiRecruiterRepository(): Promise<SupabaseAiRecruiterRepository> {
  const authClient = await createClient();
  return new SupabaseAiRecruiterRepository(authClient);
}

export async function createAiRecruiterRun(
  context: AiRecruiterEngineContext,
  input: CreateAiRecruiterRunInput,
): Promise<AiRecruiterRun> {
  const config = getAiRecruiterConfig();
  const settings = aiRecruiterRunSettingsSchema.parse({
    outreachMode: input.searchPlan.outreach_mode,
    approvalMode: config.approvalMode,
    sendEnabled: config.sendEnabled,
  });

  const repository = await createAiRecruiterRepository();
  return repository.createRun(context.organizationId, context.userId, input, settings);
}

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
