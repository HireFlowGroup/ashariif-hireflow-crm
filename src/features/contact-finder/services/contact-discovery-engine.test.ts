import { describe, expect, it, vi, beforeEach } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { Contact } from "@/features/contacts/domain";
import { toContactId } from "@/features/contacts/domain";
import { ContactDiscoveryEngine } from "@/features/contact-finder/services/contact-discovery-engine.service";
import * as existingCrm from "@/features/contact-finder/providers/implementations/existing-crm.provider";
import * as companyWebsite from "@/features/contact-finder/providers/implementations/company-website.provider";
import * as tavily from "@/features/contact-finder/providers/implementations/tavily-contact.provider";
import * as generalMailbox from "@/features/contact-finder/providers/implementations/general-mailbox.provider";

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

function crmContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: toContactId("contact-1"),
    organizationId: "org-1",
    companyId: "company-1",
    firstName: "Lisa",
    lastName: "Recruiter",
    email: "lisa.recruiter@acme.nl",
    phone: null,
    jobTitle: "Recruitment Manager",
    linkedinUrl: null,
    source: "manual",
    confidence: 0.95,
    lastVerified: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ContactDiscoveryEngine", () => {
  const context = { organizationId: "org-1", userId: "user-1" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses existing valid CRM contact", async () => {
    vi.spyOn(existingCrm, "searchExistingCrmContacts").mockReturnValue(
      existingCrm.searchExistingCrmContacts([crmContact()], baseCompany()),
    );
    vi.spyOn(companyWebsite, "searchCompanyWebsiteContacts").mockResolvedValue({ candidates: [], pagesFetched: 0, sourceUrl: null });
    vi.spyOn(tavily, "searchTavilyContacts").mockResolvedValue({ candidates: [], queries: [], rawCount: 0 });
    vi.spyOn(generalMailbox, "searchVerifiedGeneralMailboxes").mockResolvedValue([]);

    const companiesService = {
      getCompany: vi.fn().mockResolvedValue(baseCompany()),
    };
    const contactsService = {
      listContactsByCompany: vi.fn().mockResolvedValue({ contacts: [crmContact()], total: 1 }),
      createContact: vi.fn(),
    };

    const engine = new ContactDiscoveryEngine(companiesService as never, contactsService as never);
    const result = await engine.discoverForCompany(context, { companyId: "company-1", targetRoles: [] });

    expect(result.stage).toBe("contact_found");
    expect(result.selected?.email).toBe("lisa.recruiter@acme.nl");
    expect(result.selected?.contactId).toBe("contact-1");
    expect(contactsService.createContact).not.toHaveBeenCalled();
  });

  it("returns blocked_missing_contact when no usable email exists", async () => {
    vi.spyOn(existingCrm, "searchExistingCrmContacts").mockReturnValue([]);
    vi.spyOn(companyWebsite, "searchCompanyWebsiteContacts").mockResolvedValue({ candidates: [], pagesFetched: 0, sourceUrl: null });
    vi.spyOn(tavily, "searchTavilyContacts").mockResolvedValue({ candidates: [], queries: [], rawCount: 0 });
    vi.spyOn(generalMailbox, "searchVerifiedGeneralMailboxes").mockResolvedValue([]);

    const companiesService = {
      getCompany: vi.fn().mockResolvedValue(baseCompany()),
    };
    const contactsService = {
      listContactsByCompany: vi.fn().mockResolvedValue({ contacts: [], total: 0 }),
      createContact: vi.fn(),
    };

    const engine = new ContactDiscoveryEngine(companiesService as never, contactsService as never);
    const result = await engine.discoverForCompany(context, { companyId: "company-1", targetRoles: [] });

    expect(result.stage).toBe("blocked_missing_contact");
    expect(result.selected).toBeNull();
    expect(result.errorMessage).toContain("Geen bruikbaar recruitment");
  });

  it("continues when website provider fails but CRM contact exists", async () => {
    vi.spyOn(existingCrm, "searchExistingCrmContacts").mockReturnValue(
      existingCrm.searchExistingCrmContacts([crmContact()], baseCompany()),
    );
    vi.spyOn(companyWebsite, "searchCompanyWebsiteContacts").mockRejectedValue(new Error("timeout"));
    vi.spyOn(tavily, "searchTavilyContacts").mockResolvedValue({ candidates: [], queries: [], rawCount: 0 });
    vi.spyOn(generalMailbox, "searchVerifiedGeneralMailboxes").mockResolvedValue([]);

    const companiesService = {
      getCompany: vi.fn().mockResolvedValue(baseCompany()),
    };
    const contactsService = {
      listContactsByCompany: vi.fn().mockResolvedValue({ contacts: [crmContact()], total: 1 }),
      createContact: vi.fn(),
    };

    const engine = new ContactDiscoveryEngine(companiesService as never, contactsService as never);
    const result = await engine.discoverForCompany(context, { companyId: "company-1", targetRoles: [] });

    expect(result.stage).toBe("contact_found");
    expect(result.traces.some((t) => t.provider === "company_website" && t.error)).toBe(true);
  });
});

describe("runWithConcurrency isolation", () => {
  it("one failure does not stop other workers", async () => {
    const results: string[] = [];
    const items = ["a", "b", "c", "d"];

    async function worker(item: string) {
      if (item === "b") throw new Error("provider fail");
      results.push(item);
    }

    async function runWithConcurrency<T>(list: T[], limit: number, fn: (item: T) => Promise<void>) {
      let i = 0;
      const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
        while (i < list.length) {
          const current = list[i];
          i += 1;
          if (!current) continue;
          try {
            await fn(current);
          } catch {
            /* isolated */
          }
        }
      });
      await Promise.allSettled(workers);
    }

    await runWithConcurrency(items, 2, worker);
    expect(results).toContain("a");
    expect(results).toContain("c");
    expect(results).toContain("d");
  });
});
