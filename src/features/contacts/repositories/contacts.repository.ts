import type {
  Contact,
  ContactCountByCompany,
  CreateContactInput,
  ListContactsByCompanyInput,
  ListContactsByCompanyResult,
} from "@/features/contacts/domain";

export interface ContactsRepository {
  create(organizationId: string, input: CreateContactInput): Promise<Contact>;
  listByCompany(
    organizationId: string,
    input: ListContactsByCompanyInput,
  ): Promise<ListContactsByCompanyResult>;
  countByCompanyIds(
    organizationId: string,
    companyIds: string[],
  ): Promise<ContactCountByCompany[]>;
}
