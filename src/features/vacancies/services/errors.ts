export class VacanciesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VacanciesValidationError";
  }
}
