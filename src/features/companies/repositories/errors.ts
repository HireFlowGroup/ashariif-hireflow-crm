export class CompaniesRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompaniesRepositoryError";
  }
}
