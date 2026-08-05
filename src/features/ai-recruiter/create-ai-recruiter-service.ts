import { createClient } from "@/lib/supabase/server";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { createCompanyFinderService } from "@/features/company-finder/create-company-finder-service";
import { createContactDiscoveryEngine } from "@/features/contact-finder/create-contact-discovery-engine";
import { createContactsServiceFromClient } from "@/features/contacts/create-contacts-service";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import type {
  AiRecruiterEngineContext,
  AiRecruiterRun,
  CreateAiRecruiterRunInput,
} from "@/features/ai-recruiter/domain/types";
import { aiRecruiterRunSettingsSchema } from "@/features/ai-recruiter/domain/types";
import { SupabaseAiRecruiterRepository } from "@/features/ai-recruiter/repositories/supabase-ai-recruiter.repository";
import { ProspectAuditRepository } from "@/features/ai-recruiter/repositories/prospect-audit.repository";
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
  const companiesService = await createCompaniesServiceWithWriteClient(authClient);
  const contactsService = createContactsServiceFromClient(authClient);
  const contactDiscovery = await createContactDiscoveryEngine(authClient, contactsService, companiesService);
  const outreachEngine = await createOutreachEngineService();
  const prospectAudit = new ProspectAuditRepository(authClient);

  return new AiRecruiterOrchestrator(
    repository,
    companyFinder,
    contactDiscovery,
    companiesService,
    outreachEngine,
    authClient,
    prospectAudit,
  );
}
