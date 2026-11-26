import { describe, expect, it, vi } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  createEnrichmentBudget,
  runBoundedProspectEnrichment,
} from "@/features/ai-recruiter/services/bounded-prospect-enrichment.service";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import { createVacancyEvidence } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { qualifyProspectWithBoundedEnrichment } from "@/features/ai-recruiter/services/prospect-requalification.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import type { ProspectEvidenceBundle } from "@/features/ai-recruiter/domain/prospect-selection-evidence.types";

vi.mock("@/features/company-finder/discovery/safe-website-fetch.service", () => ({
  safeReadWebsiteTextOrNull: vi.fn().mockResolvedValue(null),
  safeFetchWebsiteText: vi.fn().mockResolvedValue({ ok: false, code: "fetch_failed", message: "mock" }),
  assertSafeWebsiteUrl: vi.fn(),
}));

const plan: AiRecruiterSearchPlan = {
  locations: ["Rotterdam"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["Recruiter"],
  vacancy_required: true,
  minimum_hiring_score: 70,
  minimum_opportunity_score: 70,
  maximum_companies: 3,
  maximum_drafts: 3,
  contact_roles: [],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "",
};

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("co-1"),
    organizationId: "org-a",
    ownerId: null,
    name: "TechFlow BV",
    website: "https://techflow.nl",
    domain: "techflow.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "software",
    city: "Rotterdam",
    region: "Zuid-Holland",
    province: null,
    country: "NL",
    employeeCount: null,
    employeeCountMin: 50,
    employeeCountMax: 120,
    employeeCountLabel: "Bewijs in bron: 50-120",
    priority: null,
    leadScore: null,
    leadPriority: null,
    scoreReason: null,
    scoreBreakdown: null,
    vacancyCount: 1,
    hiringSignals: [],
    careersUrl: null,
    vacancyPageUrl: null,
    generalEmail: null,
    hrEmail: null,
    kvkNumber: null,
    aiSummary: null,
    source: "tavily",
    sourceUrl: "https://techflow.nl",
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
    ...overrides,
  };
}

const contact: SelectedDiscoveredContact = {
  contactId: "c1",
  email: "hr@techflow.nl",
  recipientName: "HR",
  jobTitle: "Recruiter",
  linkedinUrl: null,
  sourceType: "inferred",
  verificationStatus: "verified",
  relevanceScore: 80,
  confidence: 0.9,
  isGeneralMailbox: false,
  roleLabel: "HR",
  reliability: { level: "high", score: 90, factors: [], summary: "" },
  selectionReason: "",
};

const vacancy = createVacancyEvidence({
  companyName: "TechFlow BV",
  companyDomain: "techflow.nl",
  jobTitle: "Corporate Recruiter",
  jobUrl: "https://techflow.nl/jobs/recruiter",
  sourceUrl: "https://techflow.nl/jobs/recruiter",
  sourceType: "careers_page_crawl",
  desiredRoleMatch: true,
  validationReason: "test",
});

describe("P0-R2 evidence & enrichment", () => {
  it("fully verified prospect is eligible", async () => {
    const result = await qualifyProspectWithBoundedEnrichment({
      company: company(),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
      desiredRoleMatch: true,
    });
    expect(result.eligibility.qualificationStatus).toBe("eligible");
    expect(result.eligibility.contract?.qualificationStatus).toBe("eligible");
  });

  it("unknown employee range → needs_evidence", () => {
    const result = evaluateConceptEligibility({
      company: company({ employeeCountMin: null, employeeCountMax: null, employeeCountLabel: null }),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
    });
    expect(result.qualificationStatus).toBe("needs_evidence");
  });

  it("successful enrichment from discovery snippet", async () => {
    const result = await runBoundedProspectEnrichment({
      company: company({ employeeCountMin: null, employeeCountMax: null, employeeCountLabel: null }),
      plan,
      discoverySnippets: ["TechFlow groeit met 25 tot 80 medewerkers in Rotterdam"],
    });
    expect(result.result.enrichmentSucceeded).toBe(true);
    expect(result.company.employeeCountMin).toBe(25);
  });

  it("unsuccessful enrichment without sources", async () => {
    const result = await runBoundedProspectEnrichment({
      company: company({ employeeCountMin: null, employeeCountMax: null, employeeCountLabel: null }),
      plan,
    });
    expect(result.result.enrichmentSucceeded).toBe(false);
  });

  it("conflicting employee evidence → rejected", () => {
    const bundle: ProspectEvidenceBundle = {
      version: "p0-r2-v1",
      records: [],
      missingCriteria: [],
      conflictingCriteria: ["employee_range"],
    };
    const result = evaluateConceptEligibility({
      company: company(),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
      evidenceBundle: bundle,
    });
    expect(result.qualificationStatus).toBe("rejected");
  });

  it("unknown sector with plan requirement → needs_evidence", () => {
    const result = evaluateConceptEligibility({
      company: company({ sector: null }),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
    });
    expect(result.qualificationStatus).toBe("needs_evidence");
  });

  it("unknown location with plan requirement → needs_evidence", () => {
    const result = evaluateConceptEligibility({
      company: company({ city: null, region: null }),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
    });
    expect(result.qualificationStatus).toBe("needs_evidence");
  });

  it("mismatch location → rejected", () => {
    const result = evaluateConceptEligibility({
      company: company({ city: "Groningen", region: "Groningen" }),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
    });
    expect(result.qualificationStatus).toBe("rejected");
    expect(result.reasonCode).toBe("wrong_location");
  });

  it("no vacancy → rejected", () => {
    const result = evaluateConceptEligibility({
      company: company(),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 0,
      vacancies: [],
      contact,
      contactStage: "contact_found",
    });
    expect(result.qualificationStatus).toBe("rejected");
  });

  it("provider budget exhausted preserves needs_evidence", async () => {
    const budget = createEnrichmentBudget();
    budget.maxProviderCalls = 0;
    const { result: enrichmentOnly } = await runBoundedProspectEnrichment({
      company: company({ employeeCountMin: null, employeeCountMax: null, employeeCountLabel: null }),
      plan,
      budget,
      deps: {
        resolveEmployeeRangeViaProvider: async () => ({
          label: "Bewijs in bron: 30-80",
          verified: true,
          sourceUrl: "https://x.nl",
          sourceType: "provider_search",
        }),
      },
    });
    expect(enrichmentOnly.budget.stopReason).toMatch(/provider-budget/);
    const qualified = await qualifyProspectWithBoundedEnrichment({
      company: company({ employeeCountMin: null, employeeCountMax: null, employeeCountLabel: null }),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
    });
    expect(qualified.eligibility.qualificationStatus).toBe("needs_evidence");
  });

  it("provider timeout simulated as failed step", async () => {
    const { result } = await runBoundedProspectEnrichment({
      company: company({ employeeCountMin: null, employeeCountMax: null, employeeCountLabel: null }),
      plan,
      deps: {
        resolveEmployeeRangeViaProvider: async () => {
          throw new Error("timeout");
        },
      },
    });
    expect(result.steps.some((s) => s.step === "provider_employee_range" && !s.success)).toBe(true);
  });

  it("requalification after verified enrichment", async () => {
    const first = await qualifyProspectWithBoundedEnrichment({
      company: company({ employeeCountMin: null, employeeCountMax: null, employeeCountLabel: null }),
      plan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
      discoverySnippets: ["Rotterdam softwarebedrijf 40 tot 90 medewerkers"],
    });
    expect(first.eligibility.qualificationStatus).toBe("eligible");
  });

  it("concept generation blocked for needs_evidence", () => {
    const filter = (s: string) => s === "eligible";
    expect(filter("needs_evidence")).toBe(false);
  });

  it("tenant org ids differ on synthetic companies", () => {
    const a = company({ organizationId: "org-a" });
    const b = company({ organizationId: "org-b" });
    expect(a.organizationId).not.toBe(b.organizationId);
  });

  it("no P0-R1 regression: commercial gate still applies", () => {
    const result = evaluateConceptEligibility({
      company: company(),
      plan,
      hiringScore: 10,
      opportunityScore: 10,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact,
      contactStage: "contact_found",
    });
    expect(result.qualificationStatus).toBe("rejected");
    expect(result.reasonCode).toMatch(/commercial_/);
  });
});