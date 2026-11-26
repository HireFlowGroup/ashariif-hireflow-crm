import { describe, expect, it } from "vitest";

import { evaluateDiscoveryPlanConstraints } from "@/features/company-finder/discovery/discovery-plan-constraint.service";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { createEmptyCandidate } from "@/features/lead-intelligence/providers/types";

const criteria = {
  locations: ["Rotterdam", "Den Haag"],
  sectors: ["software"],
  desiredRoles: ["recruiters"],
};

function candidate(overrides: Partial<ExternalCompanyCandidate> = {}): ExternalCompanyCandidate {
  return {
    ...createEmptyCandidate({
      externalId: "test:example.nl",
      name: "Example BV",
      source: "fixture",
      website: "https://example.nl",
      domain: "example.nl",
      city: "Rotterdam",
      sector: "software",
    }),
    ...overrides,
  };
}

describe("evaluateDiscoveryPlanConstraints", () => {
  it("rejects VDL-style conglomerate for software Rotterdam search (Run G RCA)", () => {
    const result = evaluateDiscoveryPlanConstraints({
      candidate: candidate({
        name: "VDL Groep",
        city: null,
        sector: null,
        website: "https://vdl.nl",
        domain: "vdl.nl",
      }),
      result: {
        title: "VDL Groep",
        url: "https://vdl.nl",
        description: "Internationale industriële familieonderneming",
      },
      criteria,
    });

    expect(result.acceptable).toBe(false);
    expect(result.reason).toBe("wrong_sector");
  });

  it("accepts Rotterdam software company with city evidence", () => {
    const result = evaluateDiscoveryPlanConstraints({
      candidate: candidate({
        name: "TechFlow BV",
        city: "Rotterdam",
        sector: "software",
      }),
      result: {
        title: "TechFlow BV",
        url: "https://techflow.nl",
        description: "Softwarebedrijf in Rotterdam",
        discoveryLocation: "Rotterdam",
      },
      criteria,
    });

    expect(result.acceptable).toBe(true);
    expect(result.location).toBe("matched");
  });

  it("rejects clear wrong-city evidence", () => {
    const result = evaluateDiscoveryPlanConstraints({
      candidate: candidate({
        name: "Eindhoven Soft",
        city: "Eindhoven",
        sector: "software",
      }),
      result: {
        title: "Eindhoven Soft",
        url: "https://eindhoven-soft.nl",
        description: "Software in Eindhoven",
      },
      criteria,
    });

    expect(result.acceptable).toBe(false);
    expect(result.reason).toBe("wrong_location");
  });
});