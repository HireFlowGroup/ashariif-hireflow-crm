import { describe, expect, it } from "vitest";

import type { CandidateDiscoveryRun } from "@/features/candidate-discovery/domain/candidate-discovery.persistence.types";
import { CandidateDiscoveryRepositoryError } from "@/features/candidate-discovery/repositories/candidate-discovery.repository.errors";
import {
  assertProposalMatchesRun,
  assertVacancyBelongsToOrganization,
} from "@/features/candidate-discovery/services/candidate-discovery-integrity.service";

const runFixture: CandidateDiscoveryRun = {
  id: "run-1",
  organizationId: "org-a",
  vacancyId: "vac-a",
  createdBy: "user-1",
  status: "completed",
  queries: [],
  queryPlan: { queries: [], vacancyTitle: "Engineer", locationHint: null, skillTerms: [] },
  searchAttempts: [],
  providerMeta: {},
  proposalCount: 0,
  belowThresholdCount: 0,
  ineligibleCount: 0,
  duplicateUrlCount: 0,
  providerFailures: 0,
  minMatchScoreUsed: 45,
  errorCode: null,
  errorMessage: null,
  startedAt: null,
  completedAt: null,
  retentionExpiresAt: "2026-12-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("assertVacancyBelongsToOrganization (F1)", () => {
  it("passes when organization matches", () => {
    expect(() => assertVacancyBelongsToOrganization("org-a", "org-a")).not.toThrow();
  });

  it("rejects cross-organization vacancy", () => {
    expect(() => assertVacancyBelongsToOrganization("org-a", "org-b")).toThrow(
      CandidateDiscoveryRepositoryError,
    );
  });

  it("rejects missing organization on vacancy", () => {
    expect(() => assertVacancyBelongsToOrganization("org-a", null)).toThrow(
      CandidateDiscoveryRepositoryError,
    );
  });
});

describe("assertProposalMatchesRun (F2)", () => {
  it("passes when run matches org and vacancy", () => {
    expect(() =>
      assertProposalMatchesRun({
        organizationId: "org-a",
        vacancyId: "vac-a",
        run: runFixture,
      }),
    ).not.toThrow();
  });

  it("rejects missing run", () => {
    expect(() =>
      assertProposalMatchesRun({
        organizationId: "org-a",
        vacancyId: "vac-a",
        run: null,
      }),
    ).toThrow(/niet gevonden/);
  });

  it("rejects vacancy mismatch", () => {
    expect(() =>
      assertProposalMatchesRun({
        organizationId: "org-a",
        vacancyId: "vac-other",
        run: runFixture,
      }),
    ).toThrow(/vacature/i);
  });

  it("rejects organization mismatch", () => {
    expect(() =>
      assertProposalMatchesRun({
        organizationId: "org-b",
        vacancyId: "vac-a",
        run: runFixture,
      }),
    ).toThrow(/organisatie/i);
  });
});