import { describe, expect, it, vi, beforeEach } from "vitest";

import { createCompanySearchJobSchema } from "@/features/company-finder/validation";
import { createDiscoveryRunApiBudget } from "@/features/company-finder/discovery/discovery-run-api-budget.service";
import { resetInMemoryRunSlotsForTests } from "@/features/ai-recruiter/services/run-slot-persistence.service";
import { saveDiscoveryCompanyWithDedupe } from "@/features/company-finder/services/discovery-company-deduplication.service";
import {
  buildTargetedDiscoveryQueryVariants,
  employerMatchesTargetedConstraints,
  extractTargetedEmployerConstraints,
} from "@/features/ai-recruiter/services/targeted-employer-constraint.service";
import { searchPlanToCompanyFinderCriteria } from "@/features/ai-recruiter/services/search-plan-parser.service";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { buildAiRecruiterRuntimeConfigSnapshot } from "@/features/ai-recruiter/services/ai-recruiter-runtime-config.service";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import { createVacancyEvidence } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import { toCompanyId, type Company } from "@/features/companies/domain";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";

const QA_RUN_ID = "11111111-1111-4111-8111-111111110001";
const QA_ORG = "7e6d935f-14c1-4b47-abb4-9ed71d34e410";

const laurasPrompt =
  "Micro-test met exact 1 werkgever: Laurens (officieel domein werkenbij.laurens.nl) in Nederland. Zoek Corporate Recruiter vacature.";

describe("P0-R3.2.7 component isolation", () => {
  it("preserves aiRecruiterRunId through company search job schema", () => {
    const payload = {
      sector: "zorg",
      desiredRoles: ["Corporate Recruiter"],
      aiRecruiterRunId: QA_RUN_ID,
      persistenceMaximumCompanies: 1,
      discoveryMode: "targeted" as const,
      targetEmployerNames: ["Laurens"],
      targetEmployerDomains: ["werkenbij.laurens.nl"],
    };
    const parsed = createCompanySearchJobSchema.parse(payload);
    expect(parsed.aiRecruiterRunId).toBe(QA_RUN_ID);
    expect(parsed.persistenceMaximumCompanies).toBe(1);
    expect(parsed.targetEmployerDomains).toEqual(["werkenbij.laurens.nl"]);
  });

  it("maps targeted employer constraints from run prompt", () => {
    const plan = {
      locations: [],
      regions: [],
      sectors: ["zorg"],
      employee_range: { min: null, max: null },
      desired_roles: ["Corporate Recruiter"],
      vacancy_required: true,
      minimum_hiring_score: 30,
      minimum_opportunity_score: 30,
      maximum_companies: 1,
      maximum_drafts: 1,
      contact_roles: [],
      outreach_mode: "draft_only",
      approval_mode: "manual",
      exclusions: [],
      uncertainties: [],
      reasoning: laurasPrompt,
    } satisfies AiRecruiterSearchPlan;

    const criteria = searchPlanToCompanyFinderCriteria(plan, laurasPrompt);
    expect(criteria.discoveryMode).toBe("targeted");
    expect(criteria.targetEmployerNames).toContain("Laurens");
    expect(criteria.targetEmployerDomains).toContain("werkenbij.laurens.nl");
  });

  it("rejects Eneco when Laurens is targeted", () => {
    const constraints = extractTargetedEmployerConstraints(laurasPrompt);
    expect(
      employerMatchesTargetedConstraints({
        companyName: "Eneco",
        domain: "werkenbijeneco.nl",
        constraints,
      }),
    ).toBe(false);
    expect(
      employerMatchesTargetedConstraints({
        companyName: "Laurens",
        domain: "werkenbij.laurens.nl",
        constraints,
      }),
    ).toBe(true);
  });

  it("builds site-targeted discovery queries only", () => {
    const constraints = extractTargetedEmployerConstraints(laurasPrompt);
    const queries = buildTargetedDiscoveryQueryVariants({
      constraints,
      roles: ["Corporate Recruiter"],
    });
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((q) => q.query.includes("site:werkenbij.laurens.nl"))).toBe(true);
  });

  it("enforces HTTP budget per provider attempt including retries", () => {
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN = "3";
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI = "2";
    const budget = createDiscoveryRunApiBudget("budget-run");
    expect(budget.tryConsumeHttpAttempt("serpapi").allowed).toBe(true);
    expect(budget.tryConsumeHttpAttempt("serpapi").allowed).toBe(true);
    expect(budget.tryConsumeHttpAttempt("serpapi").allowed).toBe(false);
    expect(budget.tryConsumeHttpAttempt("tavily").allowed).toBe(true);
    expect(budget.tryConsumeHttpAttempt("tavily").allowed).toBe(false);
    delete process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN;
    delete process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI;
  });

  describe("synthetic QA prospect (EXPLICIT_TEST_FIXTURE)", () => {
    const plan: AiRecruiterSearchPlan = {
      locations: ["Rotterdam"],
      regions: [],
      sectors: ["software"],
      employee_range: { min: 20, max: 200 },
      desired_roles: ["Corporate Recruiter"],
      vacancy_required: true,
      minimum_hiring_score: 30,
      minimum_opportunity_score: 30,
      maximum_companies: 1,
      maximum_drafts: 1,
      contact_roles: ["HR Manager"],
      outreach_mode: "draft_only",
      approval_mode: "manual",
      exclusions: [],
      uncertainties: [],
      reasoning: "EXPLICIT_TEST_FIXTURE QA",
    };

    it("qualifies fixture employer with recruitment vacancy and contact", () => {
      const vacancy = createVacancyEvidence({
        companyName: "QA TechWorks (EXPLICIT_TEST_FIXTURE)",
        companyDomain: "qa-techworks-fixture.nl",
        jobTitle: "Corporate Recruiter",
        jobUrl: "https://qa-techworks-fixture.nl/vacatures/corporate-recruiter",
        sourceUrl: "https://qa-techworks-fixture.nl/vacatures/corporate-recruiter",
        sourceType: "discovery_classification",
        desiredRoleMatch: true,
        validationReason: "fixture",
        hiringSignalStrength: 80,
      });

      const company: Company = {
        id: toCompanyId("qa-co-fixture"),
        organizationId: QA_ORG,
        ownerId: null,
        name: "QA TechWorks (EXPLICIT_TEST_FIXTURE)",
        website: "https://qa-techworks-fixture.nl",
        domain: "qa-techworks-fixture.nl",
        linkedinUrl: null,
        email: null,
        phone: null,
        sector: "software",
        city: "Rotterdam",
        region: null,
        province: null,
        country: "NL",
        employeeCount: 80,
        employeeCountMin: 20,
        employeeCountMax: 200,
        employeeCountLabel: "51-200",
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
        source: "fixture",
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
      };

      const contact: SelectedDiscoveredContact = {
        contactId: null,
        email: "recruitment@qa-techworks-fixture.nl",
        recipientName: "Recruitment",
        jobTitle: "Corporate Recruiter",
        linkedinUrl: null,
        sourceType: "company_website",
        verificationStatus: "verified",
        relevanceScore: 85,
        confidence: 0.9,
        isGeneralMailbox: false,
        roleLabel: "Recruiter",
        selectionReason: "fixture",
      } as SelectedDiscoveredContact;

      const result = evaluateConceptEligibility({
        company,
        plan,
        hiringScore: 85,
        opportunityScore: 82,
        vacancyCount: 1,
        vacancies: [vacancy],
        contact,
        contactStage: "contact_found",
        desiredRoleMatch: true,
      });

      expect(result.eligible).toBe(true);
    });
  });

  describe("slot reservation fail-closed", () => {
    beforeEach(() => {
      resetInMemoryRunSlotsForTests();
    });

    it("throws when RPC returns false while run persistence is required", async () => {
      const qualified: QualifiedDiscoveryCandidate = {
        candidate: {
          name: "QA Slot Co (EXPLICIT_TEST_FIXTURE)",
          website: "https://qa-slot-fixture.nl",
          domain: "qa-slot-fixture.nl",
        } as QualifiedDiscoveryCandidate["candidate"],
        companyType: "company_website",
        companyConfidence: 80,
        discoveryReason: "EXPLICIT_TEST_FIXTURE",
        discoveryProvider: "fixture",
        urlCategory: "company",
        homepageSignalCount: 1,
        saveStatus: "company",
      };

      await expect(
        saveDiscoveryCompanyWithDedupe({
          companiesService: {
            createDiscoveryCompany: vi.fn(),
            updateCompany: vi.fn(),
          } as never,
          context: { organizationId: QA_ORG, userId: "user-qa" },
          qualified,
          existingCompanies: [],
          runPersistence: {
            organizationId: QA_ORG,
            runId: QA_RUN_ID,
            maximumCompanies: 1,
            client: {
              rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
            } as never,
          },
        }),
      ).rejects.toThrow(/Database-slot niet gereserveerd/);
    });
  });

  it("builds runtime config snapshot without fail-closed errors in test env", () => {
    const snapshot = buildAiRecruiterRuntimeConfigSnapshot();
    expect(snapshot.discovery.maxHttpAttemptsPerRun).toBeGreaterThan(0);
    expect(snapshot.failClosed).toBe(false);
  });
});