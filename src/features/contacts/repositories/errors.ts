export class ContactsRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactsRepositoryError";
  }
}
