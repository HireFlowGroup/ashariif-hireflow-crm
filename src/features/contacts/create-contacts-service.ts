import type { SupabaseClient } from "@supabase/supabase-js";

import { ContactsService } from "@/features/contacts/services/contacts.service";
import { SupabaseContactsRepository } from "@/features/contacts/repositories/supabase-contacts.repository";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export function createContactsServiceFromClient(
  client: SupabaseClient<Database>,
): ContactsService {
  return new ContactsService(new SupabaseContactsRepository(client));
}

export async function createContactsService(): Promise<ContactsService> {
  const client = await createClient();
  return createContactsServiceFromClient(client);
}
