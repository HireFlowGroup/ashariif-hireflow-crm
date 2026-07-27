export class CompaniesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompaniesValidationError";
  }
}
