export class ContactsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactsValidationError";
  }
}
