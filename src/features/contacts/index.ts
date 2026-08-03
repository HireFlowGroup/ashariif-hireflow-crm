export {
  type Contact,
  type ContactCountByCompany,
  type ContactId,
  type CreateContactInput,
  type ListContactsByCompanyInput,
  type ListContactsByCompanyResult,
  toContactId,
} from "./domain";
export { createContactsService } from "./create-contacts-service";
export {
  ContactsService,
  type ContactsServiceContext,
} from "./services/contacts.service";
