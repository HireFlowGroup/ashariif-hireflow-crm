import { ContactsValidationError } from "@/features/contacts/services/errors";
import { ContactsRepositoryError } from "@/features/contacts/repositories/errors";
import { ContactSearchJobRepositoryError } from "@/features/contact-finder/repositories/errors";
import { ContactFinderServiceError } from "@/features/contact-finder/services/errors";
import { mapCompanyErrorToMessage } from "@/lib/companies/api-errors";

export function mapContactErrorToMessage(error: unknown): string {
  if (error instanceof ContactsValidationError) {
    return error.message;
  }

  if (error instanceof ContactsRepositoryError) {
    return error.message;
  }

  if (error instanceof ContactSearchJobRepositoryError) {
    return error.message;
  }

  if (error instanceof ContactFinderServiceError) {
    return error.message;
  }

  return "Contactpersonen konden niet worden geladen. Probeer het opnieuw.";
}

export function mapLoaderErrorToMessage(error: unknown): string {
  const contactMessage = mapContactErrorToMessage(error);

  if (contactMessage !== "Contactpersonen konden niet worden geladen. Probeer het opnieuw.") {
    return contactMessage;
  }

  return mapCompanyErrorToMessage(error);
}
