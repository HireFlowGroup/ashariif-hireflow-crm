import { describe, expect, it } from "vitest";

import { rankDiscoveryCandidateForPersistence } from "@/features/ai-recruiter/services/discovery-persistence-priority.service";
import { limitQualifiedDiscoveryCandidatesForPersistence } from "@/features/ai-recruiter/services/search-plan-limits.service";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";

function qualified(
  name: string,
  overrides: Partial<QualifiedDiscoveryCandidate["candidate"]> & {
    companyConfidence?: number;
    companyType?: QualifiedDiscoveryCandidate["companyType"];
  } = {},
): QualifiedDiscoveryCandidate {
  const domain = `${name.toLowerCase().replace(/\s/g, "")}.nl`;
  return {
    candidate: {
      name,
      city: overrides.city ?? "Rotterdam",
      sector: overrides.sector ?? "software",
      website: `https://${domain}`,
      domain,
      confidence: overrides.confidence ?? 0.8,
      vacancyTitles: overrides.vacancyTitles ?? [],
      vacancyCount: overrides.vacancyTitles?.length ?? 0,
      vacancyPageUrl: overrides.vacancyPageUrl ?? null,
    } as QualifiedDiscoveryCandidate["candidate"],
    companyType: overrides.companyType ?? "company_website",
    companyConfidence: overrides.companyConfidence ?? 0.85,
    discoveryReason: "test",
    discoveryProvider: "serpapi",
    urlCategory: "company",
    homepageSignalCount: 3,
    saveStatus: "company",
  };
}

describe("discovery persistence priority", () => {
  it("prefers desired-role vacancy match over higher confidence without vacancy", () => {
    const withRole = qualified("RoleMatch", {
      vacancyTitles: ["Corporate Recruiter"],
      vacancyPageUrl: "https://rolematch.nl/vacatures/corporate-recruiter/",
      confidence: 0.7,
      companyConfidence: 0.72,
    });
    const highConf = qualified("HighConf", { confidence: 0.95, companyConfidence: 0.95 });

    const { toPersist } = limitQualifiedDiscoveryCandidatesForPersistence(
      [highConf, withRole],
      1,
      {
        locations: ["Rotterdam"],
        sectors: ["software"],
        desiredRoles: ["recruiters"],
      },
    );

    expect(toPersist[0]?.candidate.name).toBe("RoleMatch");
  });

  it("penalizes agencies below employers", () => {
    const agency = qualified("Agency", { companyType: "agency", companyConfidence: 0.9 });
    const employer = qualified("Employer", { companyConfidence: 0.75 });
    expect(rankDiscoveryCandidateForPersistence(employer)).toBeGreaterThan(
      rankDiscoveryCandidateForPersistence(agency),
    );
  });
});