import { CandidatesServiceError } from "@/features/candidates/repositories/errors";
import { VacanciesValidationError } from "@/features/vacancies/services/errors";
import { VacanciesRepositoryError } from "@/features/vacancies/repositories/errors";

export function mapVacancyErrorToStatus(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof VacanciesValidationError) {
    if (error.message === "Vacature niet gevonden.") {
      return { status: 404, message: error.message };
    }

    return { status: 400, message: error.message };
  }

  if (error instanceof VacanciesRepositoryError) {
    return { status: 500, message: error.message };
  }

  if (error instanceof Error && error.message === "Vacature niet gevonden.") {
    return { status: 404, message: error.message };
  }

  if (error instanceof CandidatesServiceError) {
    return { status: 404, message: error.message };
  }

  if (error instanceof Error && error.message === "Geef candidateId of candidate-profiel op.") {
    return { status: 400, message: error.message };
  }

  return {
    status: 500,
    message: "Er ging iets mis. Probeer het opnieuw.",
  };
}
