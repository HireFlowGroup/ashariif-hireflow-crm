import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import {
  findDuplicateRecipient,
  isValidEmail,
  selectRecipient,
  type OutreachContactRecord,
} from "@/features/outreach-engine/services/recipient-selection.service";

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
    outreachOptOut: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const hrContact: OutreachContactRecord = {
  id: "c1",
  firstName: "Jan",
  lastName: "Jansen",
  jobTitle: "HR Manager",
  email: "jan.jansen@acme.nl",
  confidence: 0.9,
  outreachOptOut: false,
};

describe("recipient selection", () => {
  it("prioritizes HR Manager contact over generic mailbox", () => {
    const result = selectRecipient({
      company: baseCompany(),
      contacts: [hrContact],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(),
      recentlyContactedCompanyIds: new Set(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipientEmail).toBe("jan.jansen@acme.nl");
      expect(result.source).toBe("contact");
    }
  });

  it("blocks when no valid recipient", () => {
    const result = selectRecipient({
      company: baseCompany({ hrEmail: null, domain: null }),
      contacts: [],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(),
      recentlyContactedCompanyIds: new Set(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing_recipient");
  });

  it("blocks invalid email format", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("hr@acme.nl")).toBe(true);
  });

  it("blocks duplicate active recipient", () => {
    expect(findDuplicateRecipient("jan@acme.nl", new Set(["jan@acme.nl"]))).toBe(true);
    expect(findDuplicateRecipient("jan@acme.nl", new Set(["other@acme.nl"]))).toBe(false);
  });

  it("blocks bounced addresses", () => {
    const result = selectRecipient({
      company: baseCompany(),
      contacts: [{ ...hrContact, email: "jan.jansen@acme.nl" }],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(["jan.jansen@acme.nl"]),
      recentlyContactedCompanyIds: new Set(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.recipientEmail).toBe("hr@acme.nl");
  });

  it("blocks opt-out company", () => {
    const result = selectRecipient({
      company: baseCompany({ outreachOptOut: true }),
      contacts: [hrContact],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(),
      recentlyContactedCompanyIds: new Set(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("opt_out");
  });

  it("blocks archived company", () => {
    const result = selectRecipient({
      company: baseCompany({ status: "archived" }),
      contacts: [hrContact],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(),
      recentlyContactedCompanyIds: new Set(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("archived");
  });

  it("blocks company in cooldown window", () => {
    const result = selectRecipient({
      company: baseCompany(),
      contacts: [hrContact],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(),
      recentlyContactedCompanyIds: new Set(["company-1"]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("cooldown");
  });

  it("uses generic hr mailbox when no named contact", () => {
    const result = selectRecipient({
      company: baseCompany(),
      contacts: [],
      suppressedEmails: new Set(),
      bouncedEmails: new Set(),
      recentlyContactedCompanyIds: new Set(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.recipientEmail).toBe("hr@acme.nl");
  });
});
