import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Contact,
  ContactCountByCompany,
  CreateContactInput,
  ListContactsByCompanyInput,
  ListContactsByCompanyResult,
} from "@/features/contacts/domain";
import type { ContactsRepository } from "@/features/contacts/repositories/contacts.repository";
import {
  mapContactRowToDomain,
  mapCreateInputToRow,
} from "@/features/contacts/repositories/contact.mapper";
import { ContactsRepositoryError } from "@/features/contacts/repositories/errors";
import type { Database } from "@/types/database";

export class SupabaseContactsRepository implements ContactsRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(organizationId: string, input: CreateContactInput): Promise<Contact> {
    const row = mapCreateInputToRow(organizationId, input);

    const { data, error } = await this.client
      .from("contacts")
      .insert(row)
      .select("*")
      .single();

    if (error || !data) {
      throw new ContactsRepositoryError("Contact kon niet worden opgeslagen.");
    }

    return mapContactRowToDomain(data);
  }

  async listByCompany(
    organizationId: string,
    input: ListContactsByCompanyInput,
  ): Promise<ListContactsByCompanyResult> {
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;

    const { data, error, count } = await this.client
      .from("contacts")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("company_id", input.companyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error?.message) {
      throw new ContactsRepositoryError("Contactpersonen konden niet worden opgehaald.");
    }

    return {
      contacts: (data ?? []).map(mapContactRowToDomain),
      total: count ?? 0,
    };
  }

  async countByCompanyIds(
    organizationId: string,
    companyIds: string[],
  ): Promise<ContactCountByCompany[]> {
    if (companyIds.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from("contacts")
      .select("company_id")
      .eq("organization_id", organizationId)
      .in("company_id", companyIds);

    if (error?.message) {
      throw new ContactsRepositoryError("Contacttelling kon niet worden opgehaald.");
    }

    const counts = new Map<string, number>();

    for (const companyId of companyIds) {
      counts.set(companyId, 0);
    }

    for (const row of data ?? []) {
      const companyId = row.company_id;

      if (!companyId) {
        continue;
      }

      counts.set(companyId, (counts.get(companyId) ?? 0) + 1);
    }

    return companyIds.map((companyId) => ({
      companyId,
      count: counts.get(companyId) ?? 0,
    }));
  }
}
