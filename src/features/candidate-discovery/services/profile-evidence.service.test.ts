import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Vacancy } from "@/features/vacancies/domain";
import { toVacancyId } from "@/features/vacancies/domain";
import type { ParsedSerpProfile } from "@/features/candidate-discovery/domain/candidate-discovery.types";
import { assessProfileEvidence } from "@/features/candidate-discovery/services/profile-evidence.service";

const vacancy: Vacancy = {
  id: toVacancyId("v"),
  organizationId: "org",
  companyId: toCompanyId("c"),
  ownerId: null,
  title: "Senior Software Engineer",
  description: null,
  location: "Utrecht",
  employmentType: "full_time",
  salaryMin: null,
  salaryMax: null,
  status: "open",
  requirements: "TypeScript, React",
  createdAt: "x",
  updatedAt: "x",
};

const baseProfile: ParsedSerpProfile = {
  linkedinUrl: "https://www.linkedin.com/in/x",
  firstName: "Onbekend",
  lastName: "Onbekend",
  candidateCurrentRole: "Senior Software Engineer",
  location: null,
  summary: "TypeScript developer",
  skills: ["typescript"],
  experienceYears: null,
  unknownFields: [],
  serpTitle: "Senior Software Engineer | LinkedIn",
  serpSnippet: "TypeScript developer",
  serpUrl: "https://www.linkedin.com/in/x",
};

describe("assessProfileEvidence", () => {
  it("requires secondary evidence beyond role title alone", () => {
    const onlyTitle: ParsedSerpProfile = {
      ...baseProfile,
      skills: [],
      summary: null,
      serpSnippet: "",
      candidateCurrentRole: null,
      serpTitle: "Senior Software Engineer | LinkedIn",
    };
    const result = assessProfileEvidence(vacancy, onlyTitle);
    expect(result.eligibleForRanking).toBe(false);
    expect(result.hasRoleSignal).toBe(true);
    expect(result.hasSecondarySignal).toBe(false);
  });

  it("accepts role plus skill evidence in snippet", () => {
    const result = assessProfileEvidence(vacancy, baseProfile);
    expect(result.eligibleForRanking).toBe(true);
    expect(result.secondarySignals.some((s) => s.includes("vaardigheid"))).toBe(true);
  });
});