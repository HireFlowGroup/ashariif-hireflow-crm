import { CandidateDiscoveryRepositoryError } from "@/features/candidate-discovery/repositories/candidate-discovery.repository.errors";
import type { CandidateDiscoveryRun } from "@/features/candidate-discovery/domain/candidate-discovery.persistence.types";

/** F1 — vacature hoort bij organisatie (application-layer, vóór DB-trigger). */
export function assertVacancyBelongsToOrganization(
  organizationId: string,
  vacancyOrganizationId: string | null | undefined,
): void {
  if (!vacancyOrganizationId || vacancyOrganizationId !== organizationId) {
    throw new CandidateDiscoveryRepositoryError(
      "Vacature hoort niet bij deze organisatie.",
    );
  }
}

/** F2 — run en input consistent voor proposal-insert. */
export function assertProposalMatchesRun(input: {
  organizationId: string;
  vacancyId: string;
  run: CandidateDiscoveryRun | null;
}): void {
  if (!input.run) {
    throw new CandidateDiscoveryRepositoryError("Discovery-run niet gevonden.");
  }
  if (input.run.organizationId !== input.organizationId) {
    throw new CandidateDiscoveryRepositoryError(
      "Discovery-run hoort niet bij deze organisatie.",
    );
  }
  if (input.run.vacancyId !== input.vacancyId) {
    throw new CandidateDiscoveryRepositoryError(
      "Vacature komt niet overeen met de discovery-run.",
    );
  }
}