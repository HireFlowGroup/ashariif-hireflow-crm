export class VacanciesRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VacanciesRepositoryError";
  }
}
