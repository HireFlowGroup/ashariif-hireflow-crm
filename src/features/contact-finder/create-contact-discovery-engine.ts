import type { SupabaseClient } from "@supabase/supabase-js";

import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import { createContactsServiceFromClient } from "@/features/contacts/create-contacts-service";
import type { ContactsService } from "@/features/contacts/services/contacts.service";
import {
  ContactDiscoveryEngine,
  createContactDiscoveryEngine as buildContactDiscoveryEngine,
} from "@/features/contact-finder/services/contact-discovery-engine.service";

export async function createContactDiscoveryEngine(
  authClient: SupabaseClient,
  contactsService?: ContactsService,
  companiesService?: CompaniesService,
): Promise<ContactDiscoveryEngine> {
  const contacts = contactsService ?? createContactsServiceFromClient(authClient);
  const companies = companiesService ?? (await createCompaniesServiceWithWriteClient(authClient));
  return buildContactDiscoveryEngine(companies, contacts, authClient);
}

export type { ContactDiscoveryEngine };
