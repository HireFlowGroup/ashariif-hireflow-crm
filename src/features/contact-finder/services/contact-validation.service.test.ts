import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import {
  buildOutreachSalutation,
  rejectContactCandidate,
  type DiscoveredContactCandidate,
} from "@/features/contact-finder/services/contact-validation.service";

function baseCompany(overrides: Partial<Company> = {}): Company {
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
    hrEmail: "hr@acme.nl",
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
    ...overrides,
  };
}

function verification(
  email: string,
  overrides: Partial<import("@/features/contact-finder/email-verification/email-verification.types").EmailVerificationResult> = {},
) {
  return {
    email,
    status: "likely" as const,
    syntaxValid: true,
    domainValid: true,
    mxValid: true,
    disposable: false,
    roleMailbox: false,
    catchAll: false,
    reasons: [],
    ...overrides,
  };
}

function candidate(overrides: Partial<DiscoveredContactCandidate>): DiscoveredContactCandidate {
  return {
    firstName: "Jan",
    lastName: "Jansen",
    fullName: "Jan Jansen",
    email: "jan.jansen@acme.nl",
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
    externalId: "ext-1",
    ...overrides,
  };
}

describe("rejectContactCandidate", () => {
  const emptySets = { suppressedEmails: new Set<string>(), bouncedEmails: new Set<string>() };

  it("rejects personal Gmail without explicit company source", () => {
    const rejection = rejectContactCandidate(
      candidate({ email: "jan@gmail.com", sourceType: "tavily_search", emailOrigin: "extracted" }),
      baseCompany(),
      verification("jan@gmail.com"),
      emptySets,
    );
    expect(rejection?.code).toBe("personal_email");
  });

  it("rejects no-reply addresses", () => {
    const rejection = rejectContactCandidate(
      candidate({ email: "noreply@acme.nl" }),
      baseCompany(),
      verification("noreply@acme.nl", { roleMailbox: true }),
      emptySets,
    );
    expect(rejection?.code).toBe("no_reply");
  });

  it("rejects suppressed email", () => {
    const rejection = rejectContactCandidate(
      candidate({ email: "jan.jansen@acme.nl" }),
      baseCompany(),
      verification("jan.jansen@acme.nl"),
      { suppressedEmails: new Set(["jan.jansen@acme.nl"]), bouncedEmails: new Set() },
    );
    expect(rejection?.code).toBe("suppressed");
  });

  it("rejects hard bounced email", () => {
    const rejection = rejectContactCandidate(
      candidate({ email: "jan.jansen@acme.nl" }),
      baseCompany(),
      verification("jan.jansen@acme.nl"),
      { suppressedEmails: new Set(), bouncedEmails: new Set(["jan.jansen@acme.nl"]) },
    );
    expect(rejection?.code).toBe("bounced");
  });

  it("rejects invalid verification including MX-less domain", () => {
    const rejection = rejectContactCandidate(
      candidate({ email: "jan@no-mx-domain.test", emailOrigin: "inferred", sourceType: "inferred" }),
      baseCompany(),
      verification("jan@no-mx-domain.test", {
        status: "invalid",
        mxValid: false,
        reasons: ["Geen MX-records"],
      }),
      emptySets,
    );
    expect(rejection?.code).toBe("invalid_verification");
  });

  it("rejects inferred address on wrong domain", () => {
    const rejection = rejectContactCandidate(
      candidate({ email: "jan@other.nl", emailOrigin: "inferred", sourceType: "inferred" }),
      baseCompany(),
      verification("jan@other.nl", { status: "unknown" }),
      emptySets,
    );
    expect(rejection?.code).toBe("inferred_wrong_domain");
  });

  it("accepts valid CRM contact", () => {
    const rejection = rejectContactCandidate(
      candidate({}),
      baseCompany(),
      verification("jan.jansen@acme.nl"),
      emptySets,
    );
    expect(rejection).toBeNull();
  });
});

describe("buildOutreachSalutation", () => {
  it("uses first name for known person", () => {
    expect(buildOutreachSalutation("Jan Jansen", false, "jan@acme.nl")).toBe("Beste Jan,");
  });

  it("uses HR team salutation for HR mailbox", () => {
    expect(buildOutreachSalutation(null, true, "hr@acme.nl")).toBe("Beste HR- of recruitmentteam,");
  });

  it("uses formal salutation for info@", () => {
    expect(buildOutreachSalutation(null, true, "info@acme.nl")).toBe("Geachte heer/mevrouw,");
  });
});
