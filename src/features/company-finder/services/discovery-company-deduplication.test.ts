import { describe, expect, it, vi, beforeEach } from "vitest";

import { resetInMemoryRunSlotsForTests } from "@/features/ai-recruiter/services/run-slot-persistence.service";

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
    urlCategory: "company",
    homepageSignalCount: 1,
    saveStatus: "company",
  };
}

describe("saveDiscoveryCompanyWithDedupe", () => {
  beforeEach(() => {
    resetInMemoryRunSlotsForTests();
  });

  it("reserves a run slot before updating an existing duplicate when runPersistence is set", async () => {
    const existing = makeCompany();
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const result = await saveDiscoveryCompanyWithDedupe({
      companiesService: {
        updateCompany: vi.fn().mockResolvedValue(existing),
        createDiscoveryCompany: vi.fn(),
      } as never,
      context: { organizationId: "org-1", userId: "user-1" },
      qualified: makeQualified("Digital Impact", "https://www.digitalimpact.nl/"),
      existingCompanies: [existing],
      runPersistence: {
        organizationId: "org-1",
        runId: "run-1",
        maximumCompanies: 5,
        client: { rpc } as never,
      },
    });

    expect(result.type).toBe("updated");
    expect(rpc).toHaveBeenCalledWith(
      "reserve_ai_recruiter_run_slot",
      expect.objectContaining({ p_slot: "company", p_run_id: "run-1" }),
    );
  });

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
  });

  it("swallows empty-update validation errors on duplicate touch", async () => {
    const existing = makeCompany();
    const updateCompany = vi
      .fn()
      .mockRejectedValue(new Error("Minimaal één veld is verplicht voor een update."));
    const createDiscoveryCompany = vi.fn();

    const result = await saveDiscoveryCompanyWithDedupe({
      companiesService: {
        updateCompany,
        createDiscoveryCompany,
      } as never,
      context: { organizationId: "org-1", userId: "user-1" },
      qualified: makeQualified("Digital Impact", "https://www.digitalimpact.nl/"),
      existingCompanies: [existing],
    });

    expect(result.type).toBe("updated");
    expect(createDiscoveryCompany).not.toHaveBeenCalled();
  });
});
