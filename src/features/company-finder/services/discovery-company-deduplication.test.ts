import { describe, expect, it, vi } from "vitest";

import type { Company } from "@/features/companies/domain";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import {
  saveDiscoveryCompanyWithDedupe,
} from "@/features/company-finder/services/discovery-company-deduplication.service";

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "co-existing",
    organizationId: "org-1",
    name: "Digital Impact",
    website: "https://digitalimpact.nl",
    domain: "digitalimpact.nl",
    city: "Rotterdam",
    region: null,
    province: null,
    sector: "IT",
    status: "prospect",
    ownerId: "user-1",
    country: null,
  } as Company;
}

function makeQualified(name: string, website: string): QualifiedDiscoveryCandidate {
  return {
    candidate: {
      name,
      website,
      domain: website.replace(/^https?:\/\//, "").split("/")[0] ?? null,
      city: "Rotterdam",
      region: null,
      province: null,
      sector: "IT",
      source: "tavily",
      sourceUrl: website,
      externalId: `tavily:${website}`,
      confidence: 0.9,
      description: null,
      vacancyCount: 0,
    } as QualifiedDiscoveryCandidate["candidate"],
    companyType: "company_website",
    companyConfidence: 80,
    discoveryReason: "test",
    discoveryProvider: "tavily",
    urlCategory: "company_website",
    homepageSignalCount: 1,
  };
}

describe("saveDiscoveryCompanyWithDedupe", () => {
  it("reuses an existing company matched by normalized domain", async () => {
    const existing = makeCompany();
    const existingCompanies = [existing];
    const updateCompany = vi.fn().mockResolvedValue(existing);
    const createDiscoveryCompany = vi.fn();

    const result = await saveDiscoveryCompanyWithDedupe({
      companiesService: {
        updateCompany,
        createDiscoveryCompany,
      } as never,
      context: { organizationId: "org-1", userId: "user-1" },
      qualified: makeQualified("Digital Impact", "https://www.digitalimpact.nl/"),
      existingCompanies,
    });

    expect(result.type).toBe("updated");
    if (result.type === "updated") {
      expect(result.companyId).toBe("co-existing");
    }
    expect(createDiscoveryCompany).not.toHaveBeenCalled();
    expect(existingCompanies).toHaveLength(1);
  });

  it("creates a new company when no existing match is found", async () => {
    const created = {
      ...makeCompany(),
      id: "co-new",
      name: "Fresh Co",
      website: "https://freshco.nl",
      domain: "freshco.nl",
    } as Company;
    const existingCompanies: Company[] = [];
    const updateCompany = vi.fn();
    const createDiscoveryCompany = vi.fn().mockResolvedValue(created);

    const result = await saveDiscoveryCompanyWithDedupe({
      companiesService: {
        updateCompany,
        createDiscoveryCompany,
      } as never,
      context: { organizationId: "org-1", userId: "user-1" },
      qualified: makeQualified("Fresh Co", "https://freshco.nl"),
      existingCompanies,
    });

    expect(result.type).toBe("saved");
    expect(createDiscoveryCompany).toHaveBeenCalledTimes(1);
    expect(updateCompany).not.toHaveBeenCalled();
    if (result.type === "saved") {
      expect(result.companyId).toBe("co-new");
    }
    expect(existingCompanies).toHaveLength(1);
    expect(existingCompanies[0]?.id).toBe("co-new");
  });
});
