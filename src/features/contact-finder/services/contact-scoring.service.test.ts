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
    jobTitle: "Recruitment Manager",
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
  it("prefers Recruitment Manager over info@", () => {
    const ranked = rankDiscoveredContacts(
      [
        candidate({ email: "info@acme.nl", jobTitle: null, isGeneralMailbox: true, sourceType: "inferred" }),
        candidate({ email: "jan@acme.nl", jobTitle: "Recruitment Manager" }),
      ],
      baseCompany(),
    );

    const selected = selectBestDiscoveredContact(ranked);
    expect(selected?.email).toBe("jan@acme.nl");
  });

  it("selects HR mailbox when no personal contact exists", () => {
    const ranked = rankDiscoveredContacts(
      [
        candidate({
          email: "hr@acme.nl",
          jobTitle: null,
          isGeneralMailbox: true,
          sourceType: "company_website",
          emailOrigin: "published",
        }),
        candidate({
          email: "info@acme.nl",
          jobTitle: null,
          isGeneralMailbox: true,
          sourceType: "inferred",
          emailOrigin: "inferred",
        }),
      ],
      baseCompany(),
    );

    const selected = selectBestDiscoveredContact(ranked);
    expect(selected?.email).toBe("hr@acme.nl");
    expect(selected?.isGeneralMailbox).toBe(true);
  });

  it("returns null when no candidate meets minimum score", () => {
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
      baseCompany(),
    );

    expect(selectBestDiscoveredContact(ranked)).toBeNull();
  });
});
