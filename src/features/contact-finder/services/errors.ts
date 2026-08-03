export class ContactFinderServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactFinderServiceError";
  }
}
