import { describe, expect, it } from "vitest";

import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import {
  isActionableOutreachReviewItem,
  qualificationDisplayLabel,
} from "@/features/ai-recruiter/services/run-review-queue.service";
import {
  isNegativeVacancyUrl,
  isPlaceholderOpenVacancyTitle,
} from "@/features/ai-recruiter/services/vacancy-negative-signals.service";
import { strictVacancyEvidence } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { vacancyTitleMatchesDesiredRoleList } from "@/features/ai-recruiter/services/desired-role-matching.service";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { toCompanyId } from "@/features/companies/domain";

function syntheticItem(overrides: Partial<AiRecruiterRunItem> = {}): AiRecruiterRunItem {
  return {
    id: "item-1",
    runId: "run-1",
    organizationId: "org-1",
    companyId: toCompanyId("co-1"),
    companyName: "Synthetic Employer",
    status: "skipped",
    stage: "skipped",
    rejectionReason: "Testafwijzing",
    externalCompanyData: {
      eligibility: {
        qualificationStatus: "rejected",
        reasonCode: "no_matching_role",
        userMessage: "Geen recruitmentvacature.",
        eligible: false,
      },
    },
    ...overrides,
  } as AiRecruiterRunItem;
}

describe("P0-R3.2.6 functional blockers (offline)", () => {
  it("marks SoftTech-style placeholder vacancy URLs as non-strict evidence", () => {
    const url =
      "https://www.softtech.nl/vacatures/vacature/2020/08/18/geen-softwareontwikkeling-vacatures-beschikbaar";
    expect(isNegativeVacancyUrl(url)).toBe(true);
    expect(isPlaceholderOpenVacancyTitle("Open vacature softwareontwikkeling")).toBe(true);

    const evidence: VacancyEvidence = {
      companyName: "SoftTech",
      companyDomain: "softtech.nl",
      jobTitle: "Open vacature softwareontwikkeling",
      jobUrl: url,
      sourceUrl: url,
      sourceType: "careers_page_crawl",
      location: null,
      observedAt: new Date().toISOString(),
      activeStatus: "active",
      desiredRoleMatch: false,
      title: "Open vacature softwareontwikkeling",
      sourceDomain: "softtech.nl",
      publishedAt: null,
      validThrough: null,
      employmentType: null,
      department: null,
      hiringSignalStrength: 70,
      isActive: true,
      validationReason: "synthetic test",
      actuality: "known",
    };
    expect(strictVacancyEvidence(evidence)).toBe(false);
  });

  it("matches NL/EN recruitment titles without matching unrelated developer roles", () => {
    const roles = ["Corporate Recruiter", "Interne Recruiter", "Talent Acquisition Specialist"];
    for (const role of roles) {
      expect(vacancyTitleMatchesDesiredRoleList(role, roles)).toBe(true);
    }
    expect(vacancyTitleMatchesDesiredRoleList("Backend Developer", roles)).toBe(false);
  });

  it("shows rejected skipped items in run results but not in actionable queue", () => {
    const rejected = syntheticItem({
      stage: "contact_found",
      externalCompanyData: {
        eligibility: { qualificationStatus: "rejected", eligible: false, userMessage: "Geen vacature" },
        contactDiscovery: { selected: { email: "hr@test.nl" } },
      },
    });
    expect(qualificationDisplayLabel(rejected)).toBe("Afgewezen");
    expect(isActionableOutreachReviewItem(rejected)).toBe(false);

    const eligible = syntheticItem({
      status: "completed",
      stage: "contact_found",
      externalCompanyData: {
        eligibility: { qualificationStatus: "qualified", eligible: true },
        contactDiscovery: { selected: { email: "recruiter@test.nl" } },
      },
    });
    expect(isActionableOutreachReviewItem(eligible)).toBe(true);
  });
});