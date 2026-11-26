import { describe, expect, it } from "vitest";

import { parseSerpToCandidateProfile } from "@/features/candidate-discovery/services/serp-to-candidate-profile.parser";

describe("parseSerpToCandidateProfile", () => {
  it("parses name and role from linkedin title without inventing skills", () => {
    const profile = parseSerpToCandidateProfile({
      item: {
        title: "Lisa Jansen - Senior Frontend Developer | LinkedIn",
        url: "https://www.linkedin.com/in/lisa-jansen-dev",
        description: "TypeScript, React in Utrecht. 8 jaar ervaring.",
      },
      vacancySkillTerms: ["typescript", "react", "kubernetes"],
      vacancyLocation: "Utrecht",
    });

    expect(profile).not.toBeNull();
    expect(profile!.firstName).toBe("Lisa");
    expect(profile!.lastName).toBe("Jansen");
    expect(profile!.skills).toEqual(["typescript", "react"]);
    expect(profile!.skills).not.toContain("kubernetes");
    expect(profile!.experienceYears).toBe(8);
    expect(profile!.location).toBe("Utrecht");
  });

  it("marks unknown name when title has no parseable name", () => {
    const profile = parseSerpToCandidateProfile({
      item: {
        title: "Senior Frontend Developer | LinkedIn",
        url: "https://www.linkedin.com/in/only-role-no-name",
        description: "TypeScript in Utrecht",
      },
      vacancySkillTerms: ["typescript"],
      vacancyLocation: "Utrecht",
    });

    expect(profile!.firstName).toBe("Onbekend");
    expect(profile!.unknownFields).toContain("firstName");
  });

  it("returns null for non-profile urls", () => {
    const profile = parseSerpToCandidateProfile({
      item: {
        title: "ACME",
        url: "https://www.linkedin.com/company/acme",
        description: "x",
      },
      vacancySkillTerms: [],
      vacancyLocation: null,
    });
    expect(profile).toBeNull();
  });
});