import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import {
  rankDiscoveredContacts,
  selectBestDiscoveredContact,
} from "@/features/contact-finder/services/contact-scoring.service";
import type { DiscoveredContactCandidate } from "@/features/contact-finder/services/contact-validation.service";

function baseCompany(): Company {
  return {
    id: toCompanyId("company-1"),
    organizationId: "org-1",
    ownerId: null,
    name: "Acme BV",
    website: "https://acme.nl",
    domain: "acme.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "Tech",
    city: "Rotterdam",
    region: null,
    province: null,
    country: "NL",
    employeeCount: 40,
    employeeCountMin: 20,
    employeeCountMax: 50,
    employeeCountLabel: null,
    priority: null,
    leadScore: 70,
    leadPriority: "B",
    scoreReason: null,
    scoreBreakdown: null,
    vacancyCount: 2,
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
    status: "active",
    notes: null,
    outreachOptOut: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function candidate(partial: Partial<DiscoveredContactCandidate>): DiscoveredContactCandidate {
  return {
    firstName: "Jan",
    lastName: "Jansen",
    fullName: "Jan Jansen",
    email: "jan@acme.nl",
    phone: null,
    jobTitle: "HR Manager",
    department: null,
    linkedinUrl: null,
    sourceUrl: null,
    sourceType: "existing_crm",
    emailOrigin: "existing",
    isGeneralMailbox: false,
    isDecisionMaker: true,
    confidence: 0.9,
    externalId: "1",
    verification: {
      email: partial.email ?? "jan@acme.nl",
      status: "likely",
      syntaxValid: true,
      domainValid: true,
      mxValid: true,
      disposable: false,
      roleMailbox: false,
      catchAll: false,
      reasons: [],
    },
    ...partial,
  };
}

describe("selectBestDiscoveredContact", () => {
  it("prefers HR Manager over Recruiter and info@", () => {
    const company = baseCompany();
    const ranked = rankDiscoveredContacts(
      [
        candidate({ email: "info@acme.nl", jobTitle: null, isGeneralMailbox: true, sourceType: "inferred" }),
        candidate({ email: "rec@acme.nl", jobTitle: "Recruiter", fullName: "Rec Recruiter" }),
        candidate({ email: "hr.mgr@acme.nl", jobTitle: "HR Manager", fullName: "Hanne Manager" }),
      ],
      company,
    );

    const selected = selectBestDiscoveredContact(ranked, company);
    expect(selected?.email).toBe("hr.mgr@acme.nl");
    expect(selected?.roleLabel).toBe("HR Manager");
    expect(selected?.reliability.level).toBeDefined();
  });

  it("prefers recruitment@ over hr@ when no personal contact exists", () => {
    const company = baseCompany();
    const ranked = rankDiscoveredContacts(
      [
        candidate({
          email: "info@acme.nl",
          jobTitle: null,
          isGeneralMailbox: true,
          sourceType: "inferred",
          emailOrigin: "inferred",
        }),
        candidate({
          email: "hr@acme.nl",
          jobTitle: null,
          isGeneralMailbox: true,
          sourceType: "company_website",
          emailOrigin: "published",
        }),
        candidate({
          email: "recruitment@acme.nl",
          jobTitle: null,
          isGeneralMailbox: true,
          sourceType: "inferred",
          emailOrigin: "inferred",
        }),
      ],
      company,
    );

    const selected = selectBestDiscoveredContact(ranked, company);
    expect(selected?.email).toBe("recruitment@acme.nl");
    expect(selected?.isGeneralMailbox).toBe(true);
    expect(selected?.reliability.summary).toContain("Betrouwbaarheid");
  });

  it("returns null when no candidate meets minimum score", () => {
    const company = baseCompany();
    const ranked = rankDiscoveredContacts(
      [
        candidate({
          email: "info@acme.nl",
          jobTitle: null,
          isGeneralMailbox: true,
          sourceType: "inferred",
          emailOrigin: "inferred",
          verification: {
            email: "info@acme.nl",
            status: "unknown",
            syntaxValid: true,
            domainValid: true,
            mxValid: false,
            disposable: false,
            roleMailbox: true,
            catchAll: false,
            reasons: [],
          },
        }),
      ],
      company,
    );

    expect(selectBestDiscoveredContact(ranked, company)).toBeNull();
  });
});
