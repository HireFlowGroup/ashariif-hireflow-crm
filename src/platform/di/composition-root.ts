import { createClient } from "@/lib/supabase/server";
import { createCompaniesServiceFromClient } from "@/features/companies/create-companies-service";
import { createVacanciesServiceFromClient } from "@/features/vacancies/create-vacancies-service";
import { createContactsServiceFromClient } from "@/features/contacts/create-contacts-service";
import { createDashboardServiceFromClient } from "@/features/dashboard/create-dashboard-service";
import { createOutreachIntelligenceEngineFromClient } from "@/features/outreach-intelligence/create-outreach-intelligence-engine";
import { createRecruitmentAssistantServiceFromClient } from "@/features/recruitment-assistant/create-recruitment-assistant-service";
import { createProviderManager } from "@/features/lead-intelligence/providers/manager/create-provider-manager";
import { Container, platformContainer } from "@/platform/di/container";
import { TOKENS } from "@/platform/di/tokens";

/** Request-scoped composition root — single Supabase client, wired services. */
export async function createRequestContainer(): Promise<Container> {
  const container = new Container();
  const client = await createClient();

  container.register(TOKENS.SupabaseServerClient, () => client);
  container.register(TOKENS.CompaniesService, () => createCompaniesServiceFromClient(client));
  container.register(TOKENS.VacanciesService, () => createVacanciesServiceFromClient(client));
  container.register(TOKENS.ContactsService, () => createContactsServiceFromClient(client));
  container.register(TOKENS.DashboardService, () => createDashboardServiceFromClient(client));
  container.register(TOKENS.OutreachIntelligenceEngine, () =>
    createOutreachIntelligenceEngineFromClient(client),
  );
  container.register(TOKENS.RecruitmentAssistantService, () =>
    createRecruitmentAssistantServiceFromClient(client),
  );
  container.register(TOKENS.ProviderManager, () => createProviderManager());

  return container;
}

/** Global platform singletons (provider manager, etc.). */
export function bootstrapPlatformContainer(): void {
  platformContainer.register(TOKENS.ProviderManager, () => createProviderManager());
}

bootstrapPlatformContainer();
