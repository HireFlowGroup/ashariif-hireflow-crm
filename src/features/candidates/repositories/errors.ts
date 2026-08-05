export class CandidatesRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidatesRepositoryError";
  }
}

export class CandidatesServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidatesServiceError";
  }
}
