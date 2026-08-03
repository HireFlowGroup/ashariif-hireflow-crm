export class CompanyFinderServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyFinderServiceError";
  }
}
