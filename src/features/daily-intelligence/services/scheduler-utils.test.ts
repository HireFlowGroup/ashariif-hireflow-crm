import { describe, expect, it } from "vitest";

import type { Company } from "@/features/companies/domain";
import { toCompanyId } from "@/features/companies/domain";
import {
  buildCompanyRefreshCriteria,
  isSignalRelevantToCompany,
} from "@/features/daily-intelligence/services/scheduler-utils";

const company = {
  id: toCompanyId("11111111-1111-1111-1111-111111111111"),
  organizationId: "org-1",
  ownerId: null,
  name: "Acme BV",
  website: "https://acme.nl",
  domain: "acme.nl",
  linkedinUrl: null,
  email: null,
  phone: null,
  sector: "IT",
  city: "Amsterdam",
  region: "Noord-Holland",
  province: null,
  country: "NL",
  employeeCount: null,
  employeeCountMin: null,
  employeeCountMax: null,
  employeeCountLabel: null,
  priority: null,
  leadScore: 50,
  leadPriority: "C",
  scoreReason: null,
  scoreBreakdown: null,
  vacancyCount: 0,
  hiringSignals: [],
  careersUrl: null,
  vacancyPageUrl: null,
  generalEmail: null,
  hrEmail: null,
  kvkNumber: null,
  aiSummary: null,
  source: null,
  sourceUrl: null,
  confidence: null,
  companyType: null,
  companyConfidence: null,
  discoveryReason: null,
  discoveryProvider: null,
  lastVerifiedAt: null,
  outreachStatus: "none",
  status: "prospect",
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies Company;

describe("buildCompanyRefreshCriteria", () => {
  it("includes company name and location in criteria", () => {
    const criteria = buildCompanyRefreshCriteria(company);
    expect(criteria.companyName).toBe("Acme BV");
    expect(criteria.domain).toBe("acme.nl");
    expect(criteria.city).toBe("Amsterdam");
  });
});

describe("isSignalRelevantToCompany", () => {
  it("matches signals mentioning the company name", () => {
    expect(
      isSignalRelevantToCompany(
        {
          title: "Vacature bij Acme BV",
          description: "Developer gezocht",
          url: "https://indeed.nl/job/1",
        },
        company,
      ),
    ).toBe(true);
  });

  it("rejects unrelated companies", () => {
    expect(
      isSignalRelevantToCompany(
        {
          title: "Vacature bij Other Corp",
          description: "HR manager",
          url: "https://example.com",
        },
        company,
      ),
    ).toBe(false);
  });
});
