/**
 * EXPLICIT_TEST_FIXTURE — lokale end-to-end keten zonder live zoek-API's.
 */
import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { assessParsedVacancies } from "@/features/ai-recruiter/services/company-vacancy-validation.service";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import { classifyEmployeeRangeEvidence } from "@/features/ai-recruiter/services/employee-range-evidence.service";
import { createVacancyEvidence } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { limitQualifiedDiscoveryCandidatesForPersistence } from "@/features/ai-recruiter/services/search-plan-limits.service";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import { isDepartmentOrCategoryVacancyLabel } from "@/features/ai-recruiter/services/vacancy-title-noise.service";
import { P0_RUN_FG_COMPANY_RCA } from "@/features/ai-recruiter/fixtures/p0-controlled-runs-fg.fixture";

const FIXTURE_PLAN: AiRecruiterSearchPlan = {
  locations: ["Rotterdam"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiters", "accountmanagers", "customer success managers"],
  vacancy_required: true,
  minimum_hiring_score: 30,
  minimum_opportunity_score: 30,
  maximum_companies: 3,
  maximum_drafts: 3,
  contact_roles: ["HR Manager"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "EXPLICIT_TEST_FIXTURE",
};

function fixtureCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("fixture-techflow"),
    organizationId: "org-fixture",
    ownerId: null,
    name: "TechFlow BV (EXPLICIT_TEST_FIXTURE)",
    website: "https://techflow-fixture.nl",
    domain: "techflow-fixture.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "software",
    city: "Rotterdam",
    region: "Zuid-Holland",
    province: null,
    country: "NL",
    employeeCount: 80,
    employeeCountMin: 50,
    employeeCountMax: 120,
    employeeCountLabel: "50-120",
    priority: null,
    leadScore: null,
    leadPriority: null,
    scoreReason: null,
    scoreBreakdown: null,
    vacancyCount: 1,
    hiringSignals: [],
    careersUrl: "https://techflow-fixture.nl/vacatures",
    vacancyPageUrl: null,
    generalEmail: null,
    hrEmail: null,
    kvkNumber: null,
    aiSummary: null,
    source: "fixture",
    sourceUrl: "https://techflow-fixture.nl",
    confidence: 0.9,
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

const FIXTURE_QUALIFIED: QualifiedDiscoveryCandidate = {
  candidate: {
    name: "TechFlow BV (EXPLICIT_TEST_FIXTURE)",
    city: "Rotterdam",
    sector: "software",
    website: "https://techflow-fixture.nl",
    domain: "techflow-fixture.nl",
    confidence: 0.9,
    vacancyTitles: ["Corporate Recruiter"],
    vacancyCount: 1,
    vacancyPageUrl: "https://techflow-fixture.nl/vacatures/corporate-recruiter/",
  } as QualifiedDiscoveryCandidate["candidate"],
  companyType: "company_website",
  companyConfidence: 0.92,
  discoveryReason: "EXPLICIT_TEST_FIXTURE: desired role vacancy + location match",
  discoveryProvider: "fixture",
  urlCategory: "company",
  homepageSignalCount: 4,
  saveStatus: "company",
};

describe("P0 discovery → qualification E2E (EXPLICIT_TEST_FIXTURE)", () => {
  it("selects role-matching employer before cap, not first-hit noise", () => {
    const noise = {
      ...FIXTURE_QUALIFIED,
      candidate: {
        ...FIXTURE_QUALIFIED.candidate,
        name: "VDL Noise Fixture",
        domain: "vdl-fixture.nl",
        vacancyTitles: ["Sales & Marketing"],
      } as QualifiedDiscoveryCandidate["candidate"],
      companyConfidence: 0.99,
    };

    const { toPersist } = limitQualifiedDiscoveryCandidatesForPersistence(
      [noise, FIXTURE_QUALIFIED],
      1,
      {
        locations: ["Rotterdam"],
        sectors: ["software"],
        desiredRoles: FIXTURE_PLAN.desired_roles,
      },
    );

    expect(toPersist[0]?.candidate.name).toContain("TechFlow");
  });

  it("rejects department labels as vacancy evidence (Run G RCA)", () => {
    expect(isDepartmentOrCategoryVacancyLabel("Sales & Marketing")).toBe(true);
    const result = assessParsedVacancies({
      company: fixtureCompany(),
      plan: FIXTURE_PLAN,
      parsedVacancies: [
        {
          title: "Sales & Marketing",
          url: "https://techflow-fixture.nl/vacatures/sales/",
          isActive: true,
          inactiveReason: null,
        },
      ],
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("no_active_vacancy");
    expect(result.auditStatus).toBe("noise");
  });

  it("accepts concrete desired-role vacancy and passes concept eligibility", () => {
    const vacancyResult = assessParsedVacancies({
      company: fixtureCompany(),
      plan: FIXTURE_PLAN,
      parsedVacancies: [
        {
          title: "Corporate Recruiter",
          url: "https://techflow-fixture.nl/vacatures/corporate-recruiter/",
          isActive: true,
          inactiveReason: null,
        },
      ],
      evidenceSource: "careers_page_crawl",
    });

    expect(vacancyResult.status).toBe("accepted");
    expect(classifyEmployeeRangeEvidence(fixtureCompany(), FIXTURE_PLAN)).toBe("verified");

    const evidence = createVacancyEvidence({
      companyName: fixtureCompany().name,
      companyDomain: "techflow-fixture.nl",
      jobTitle: "Corporate Recruiter",
      jobUrl: "https://techflow-fixture.nl/vacatures/corporate-recruiter/",
      sourceUrl: "https://techflow-fixture.nl/vacatures/corporate-recruiter/",
      sourceType: "careers_page_crawl",
      desiredRoleMatch: true,
      validationReason: "EXPLICIT_TEST_FIXTURE",
    });

    const eligibility = evaluateConceptEligibility({
      company: fixtureCompany(),
      plan: FIXTURE_PLAN,
      hiringScore: 75,
      opportunityScore: 75,
      vacancyCount: 1,
      vacancies: [evidence],
      contact: {
        email: "hr@techflow-fixture.nl",
        isGeneralMailbox: false,
        recipientName: "HR",
        jobTitle: "HR Manager",
        contactId: null,
        roleLabel: "HR Manager",
        confidence: 0.85,
        sourceType: "inferred",
        linkedinUrl: null,
        reliability: { level: "high", score: 85, factors: [], summary: "" },
        relevanceScore: 80,
        selectionReason: "fixture",
        verificationStatus: "verified",
      },
      contactStage: "contact_found",
      desiredRoleMatch: true,
    });

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reasonCode).not.toBe("employee_range_unknown");
  });

  it("documents Run F/G RCA fixture rows", () => {
    expect(P0_RUN_FG_COMPANY_RCA.length).toBeGreaterThanOrEqual(6);
    const runF = P0_RUN_FG_COMPANY_RCA.filter((row) => row.run === "F");
    const runG = P0_RUN_FG_COMPANY_RCA.filter((row) => row.run === "G");
    expect(runF.length).toBeGreaterThanOrEqual(5);
    expect(runG.length).toBeGreaterThanOrEqual(1);
  });
});