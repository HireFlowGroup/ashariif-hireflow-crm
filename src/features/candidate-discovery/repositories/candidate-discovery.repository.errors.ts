export class CandidateDiscoveryRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateDiscoveryRepositoryError";
  }
}