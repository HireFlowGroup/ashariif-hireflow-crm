import { CompaniesValidationError } from "@/features/companies/services/errors";
import { CompaniesRepositoryError } from "@/features/companies/repositories/errors";

export function mapCompanyErrorToMessage(error: unknown): string {
  if (error instanceof CompaniesValidationError) {
    return error.message;
  }

  if (error instanceof CompaniesRepositoryError) {
    return error.message;
  }

  return "Bedrijven konden niet worden geladen. Probeer het opnieuw.";
}
