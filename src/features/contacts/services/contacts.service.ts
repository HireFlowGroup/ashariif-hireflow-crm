import type {
  Contact,
  ContactCountByCompany,
  CreateContactInput,
  ListContactsByCompanyInput,
  ListContactsByCompanyResult,
} from "@/features/contacts/domain";
import type { ContactsRepository } from "@/features/contacts/repositories";
import { ContactsValidationError } from "@/features/contacts/services/errors";
import {
  countContactsByCompanyIdsSchema,
  createContactInputSchema,
  listContactsByCompanyInputSchema,
} from "@/features/contacts/validation";

export type ContactsServiceContext = {
  organizationId: string;
  userId: string;
};

export class ContactsService {
  constructor(private readonly repository: ContactsRepository) {}

  async createContact(
    context: ContactsServiceContext,
    input: CreateContactInput,
  ): Promise<Contact> {
    const parsed = createContactInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new ContactsValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige contactinvoer.",
      );
    }

    return this.repository.create(context.organizationId, parsed.data);
  }

  async listContactsByCompany(
    context: ContactsServiceContext,
    input: ListContactsByCompanyInput,
  ): Promise<ListContactsByCompanyResult> {
    const parsed = listContactsByCompanyInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new ContactsValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige lijst-invoer.",
      );
    }

    return this.repository.listByCompany(context.organizationId, parsed.data);
  }

  async countContactsByCompanyIds(
    context: ContactsServiceContext,
    companyIds: string[],
  ): Promise<ContactCountByCompany[]> {
    const parsed = countContactsByCompanyIdsSchema.safeParse({ companyIds });

    if (!parsed.success) {
      throw new ContactsValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige bedrijfs-ids.",
      );
    }

    return this.repository.countByCompanyIds(context.organizationId, parsed.data.companyIds);
  }
}
