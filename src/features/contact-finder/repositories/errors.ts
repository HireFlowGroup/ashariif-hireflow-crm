export class ContactSearchJobRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactSearchJobRepositoryError";
  }
}
