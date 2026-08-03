import { createClient } from "@/lib/supabase/server";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import { createContactsService } from "@/features/contacts/create-contacts-service";
import { ContactFinderService } from "@/features/contact-finder/services/contact-finder.service";
import { SupabaseContactSearchJobRepository } from "@/features/contact-finder/repositories";

export async function createContactFinderService(): Promise<ContactFinderService> {
  const client = await createClient();
  const companiesService = await createCompaniesService();
  const contactsService = await createContactsService();

  return new ContactFinderService(
    new SupabaseContactSearchJobRepository(client),
    companiesService,
    contactsService,
  );
}
