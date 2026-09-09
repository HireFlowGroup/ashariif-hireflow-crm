import { describe, expect, it, vi } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { assessVacancyEvidence } from "@/features/ai-recruiter/services/company-vacancy-validation.service";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import {
  parseEmployeeRangeFromLabel,
  employeeRangeEnrichmentRequired,
  companyNeedsEmployeeRangeEnrichment,
} from "@/features/ai-recruiter/services/employee-range-enrichment.service";
import {
  buildDiscoveryVacancyEvidenceFromCompany,
  createVacancyEvidence,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";
import {
  buildVacancyDrivenDiscoveryQueries,
  selectDiscoveryQueries,
} from "@/features/ai-recruiter/services/discovery-query-builder.service";
import { createCompanySearchJobSchema } from "@/features/company-finder/validation/finder.schemas";
import {
  evaluateDiscoveryEmployerForSave,
  shouldExcludeRecruitmentAgenciesForPlan,
} from "@/features/company-finder/discovery/discovery-employer-criteria.service";
import {
  evaluateUsefulRecall,
  shouldTriggerSerpApiFallback,
} from "@/features/company-finder/discovery/discovery-useful-recall.service";
import type { EnrichedDiscoveryResult } from "@/features/company-finder/discovery/discovery-result.types";
import { searchPlanToCompanyFinderCriteria } from "@/features/ai-recruiter/services/search-plan-parser.service";

const plan: AiRecruiterSearchPlan = {
  locations: ["Rotterdam", "Den Haag"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiters", "accountmanagers", "customer success managers"],
  vacancy_required: true,
  minimum_hiring_score: 30,
  minimum_opportunity_score: 30,
  maximum_companies: 25,
  maximum_drafts: 10,
  contact_roles: ["HR Manager"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "",
};

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("company-1"),
    organizationId: "org-1",
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
    hiringSignals: [
      {
        type: "active_vacancy",
        description: "Corporate Recruiter",
        source: "discovery",
        confidence: 0.75,
      },
    ],
    careersUrl: null,
    vacancyPageUrl: "https://techflow.nl/vacatures/corporate-recruiter/",
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

function makeEnriched(overrides: Partial<EnrichedDiscoveryResult>): EnrichedDiscoveryResult {
  return {
    title: "Recruiter",
    url: "https://example.nl/vacatures/recruiter",
    description: null,
    query: "recruiter vacature Rotterdam software",
    resultType: "individual_vacancy",
    classificationConfidence: 0.9,
    classificationReason: "test",
    extractedCompanyName: "Example BV",
    extractedEmployer: "Example BV",
    officialDomain: "example.nl",
    domainConfidence: 0.9,
    domainSource: "url",
    vacancyTitle: "Recruiter",
    vacancyUrl: "https://example.nl/vacatures/recruiter",
    vacancySource: "tavily",
    excludedCompetitor: false,
    accepted: true,
    rejectionReason: null,
    ...overrides,
  };
}

describe("phase 2 — multi-location propagation", () => {
  it("preserves Rotterdam + Den Haag through job schema and query generation", () => {
    const criteria = searchPlanToCompanyFinderCriteria(plan, "test prompt");
    const parsed = createCompanySearchJobSchema.parse(criteria);

    expect(parsed.locations).toEqual(["Rotterdam", "Den Haag"]);
    expect(parsed.city).toBe("Rotterdam");

    const selected = selectDiscoveryQueries(
      buildVacancyDrivenDiscoveryQueries(parsed, plan),
    );
    expect(selected.some((q) => q.location === "Rotterdam")).toBe(true);
    expect(selected.some((q) => q.location === "Den Haag")).toBe(true);
  });

  it("preserves a single location correctly", () => {
    const singlePlan = { ...plan, locations: ["Utrecht"] };
    const parsed = createCompanySearchJobSchema.parse(
      searchPlanToCompanyFinderCriteria(singlePlan, "test"),
    );
    expect(parsed.locations).toEqual(["Utrecht"]);
    expect(parsed.city).toBe("Utrecht");
  });

  it("preserves three locations without city overwriting locations[]", () => {
    const multiPlan = { ...plan, locations: ["Rotterdam", "Den Haag", "Utrecht"] };
    const parsed = createCompanySearchJobSchema.parse(
      searchPlanToCompanyFinderCriteria(multiPlan, "test"),
    );
    expect(parsed.locations).toEqual(["Rotterdam", "Den Haag", "Utrecht"]);
    expect(parsed.city).toBe("Rotterdam");
  });
});

describe("phase 2 — discovery vacancy evidence preserved", () => {
  it("builds strict discovery evidence from preserved company fields", () => {
    const evidence = buildDiscoveryVacancyEvidenceFromCompany(makeCompany(), plan);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.sourceType).toBe("discovery_classification");
    expect(evidence[0]?.jobUrl).toBe("https://techflow.nl/vacatures/corporate-recruiter/");
    expect(strictVacancyEvidence(evidence[0]!)).toBe(true);
  });

  it("keeps discovery evidence when careers crawl finds nothing", () => {
    const company = makeCompany();
    const discoveryEvidence = buildDiscoveryVacancyEvidenceFromCompany(company, plan);
    const result = assessVacancyEvidence({
      company,
      plan,
      parsedVacancies: [],
      preservedDiscoveryEvidence: discoveryEvidence,
      evidenceSource: "careers_page_crawl",
    });

    expect(result.status).toBe("accepted");
    expect(result.vacancies).toHaveLength(1);
    expect(result.vacancies[0]?.sourceType).toBe("discovery_classification");
  });

  it("rejects generic careers listing pages even when preserved from crawl", () => {
    const result = assessVacancyEvidence({
      company: makeCompany({ vacancyPageUrl: "https://techflow.nl/vacatures" }),
      plan,
      parsedVacancies: [],
      preservedDiscoveryEvidence: [],
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("no_active_vacancy");
    expect(hasConcreteJobUrl("https://techflow.nl/vacatures")).toBe(false);
  });
});

describe("phase 2 — employee enrichment before qualification", () => {
  it("parses numeric employee labels", () => {
    expect(parseEmployeeRangeFromLabel("20 tot 200 medewerkers")).toEqual({ min: 20, max: 200 });
    expect(parseEmployeeRangeFromLabel("11-50 medewerkers")).toEqual({ min: 11, max: 50 });
  });

  it("requires enrichment when plan has employee constraint and company is unknown", () => {
    expect(employeeRangeEnrichmentRequired(plan)).toBe(true);
    expect(companyNeedsEmployeeRangeEnrichment(makeCompany({ employeeCountMin: null, employeeCountMax: null }))).toBe(
      true,
    );
  });

  it("blocks qualification when employee range stays unknown after enrichment gap", () => {
    const evidence = buildDiscoveryVacancyEvidenceFromCompany(makeCompany(), plan);
    const result = evaluateConceptEligibility({
      company: makeCompany({ employeeCountMin: null, employeeCountMax: null }),
      plan,
      hiringScore: 80,
      vacancyCount: 1,
      vacancies: evidence,
      contact: {
        email: "hr@techflow.nl",
        isGeneralMailbox: false,
        recipientName: "HR",
        jobTitle: "HR Manager",
        contactId: null,
        roleLabel: null,
        confidence: 0.9,
        sourceType: "inferred",
        linkedinUrl: null,
        reliability: { level: "high", score: 90, factors: [], summary: "" },
        relevanceScore: 80,
        selectionReason: "",
        verificationStatus: "verified",
      },
      contactStage: "contact_found",
      desiredRoleMatch: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("employee_range_unknown");
  });
});

describe("phase 2 — criteria-aware employer filter", () => {
  it("rejects jobboard domains", () => {
    const result = evaluateDiscoveryEmployerForSave({
      name: "Indeed",
      domain: "indeed.com",
      url: "https://www.indeed.com/viewjob",
      excludeRecruitmentAgencies: true,
    });
    expect(result.acceptable).toBe(false);
    expect(result.reason).toBe("vacancy_board");
  });

  it("rejects recruitment agencies by default", () => {
    const result = evaluateDiscoveryEmployerForSave({
      name: "Randstad",
      domain: "randstad.nl",
      url: "https://www.randstad.nl",
      excludeRecruitmentAgencies: true,
      plan,
    });
    expect(result.acceptable).toBe(false);
    expect(result.reason).toBe("recruitment_agency_excluded");
  });

  it("allows recruitment agencies when explicitly requested in plan", () => {
    expect(
      shouldExcludeRecruitmentAgenciesForPlan(
        {
          sectors: ["uitzendbureaus"],
          desired_roles: ["recruiters"],
          reasoning: "Zoek uitzendbureaus die recruiters zoeken",
        },
        true,
      ),
    ).toBe(false);

    const result = evaluateDiscoveryEmployerForSave({
      name: "StaffYou Uitzendbureau",
      domain: "staffyou.nl",
      url: "https://staffyou.nl",
      excludeRecruitmentAgencies: true,
      plan: {
        sectors: ["uitzendbureaus"],
        desired_roles: ["recruiters"],
        reasoning: "Zoek uitzendbureaus die recruiters zoeken",
      },
    });
    expect(result.acceptable).toBe(true);
  });
});

describe("phase 2 — SerpAPI usable recall fallback", () => {
  it("does not trigger when usable employer prospects with role match exist", () => {
    const metrics = evaluateUsefulRecall(
      [makeEnriched({})],
      plan.desired_roles,
    );
    expect(metrics.usableEmployerProspects).toBe(1);
    expect(
      shouldTriggerSerpApiFallback(metrics, {
        serpApiAvailable: true,
        tavilyFailed: false,
        vacancyFocusedQuery: true,
      }).trigger,
    ).toBe(false);
  });

  it("triggers when only superficial employer-hosted pages without role-matched concrete vacancies", () => {
    const metrics = evaluateUsefulRecall(
      [
        makeEnriched({
          resultType: "company_careers_page",
          url: "https://example.nl/careers",
          vacancyUrl: null,
          vacancyTitle: null,
          title: "Careers at Example",
        }),
      ],
      plan.desired_roles,
    );

    expect(metrics.concreteVacancyPages).toBe(0);
    expect(metrics.usableEmployerProspects).toBe(0);
    const decision = shouldTriggerSerpApiFallback(metrics, {
      serpApiAvailable: true,
      tavilyFailed: false,
      vacancyFocusedQuery: true,
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reason).toContain("0 concrete vacaturepagina");
  });
});

describe("phase 2 — integrated funnel", () => {
  it("qualifies when discovery evidence, role match, employee range and contact align", () => {
    const company = makeCompany();
    const discoveryEvidence = buildDiscoveryVacancyEvidenceFromCompany(company, plan);
    const validation = assessVacancyEvidence({
      company,
      plan,
      parsedVacancies: [],
      preservedDiscoveryEvidence: discoveryEvidence,
      evidenceSource: "careers_page_crawl",
    });

    expect(validation.status).toBe("accepted");

    const eligibility = evaluateConceptEligibility({
      company,
      plan,
      hiringScore: 80,
      vacancyCount: 1,
      vacancies: validation.vacancies,
      contact: {
        email: "hr@techflow.nl",
        isGeneralMailbox: false,
        recipientName: "HR",
        jobTitle: "HR Manager",
        contactId: null,
        roleLabel: null,
        confidence: 0.9,
        sourceType: "inferred",
        linkedinUrl: null,
        reliability: { level: "high", score: 90, factors: [], summary: "" },
        relevanceScore: 80,
        selectionReason: "",
        verificationStatus: "verified",
      },
      contactStage: "contact_found",
      desiredRoleMatch: true,
    });

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reasonCode).toBe("eligible");
  });

  it("rejects wrong desired role", () => {
    const company = makeCompany({
      vacancyPageUrl: "https://techflow.nl/vacatures/cloud-engineer/",
      hiringSignals: [{ type: "active_vacancy", description: "Cloud Engineer", source: "d", confidence: 0.7 }],
    });
    const result = assessVacancyEvidence({
      company,
      plan,
      parsedVacancies: [],
      preservedDiscoveryEvidence: buildDiscoveryVacancyEvidenceFromCompany(company, plan),
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("no_matching_role");
  });

  it("rejects employee mismatch", () => {
    const evidence = buildDiscoveryVacancyEvidenceFromCompany(makeCompany(), plan);
    const result = evaluateConceptEligibility({
      company: makeCompany({ employeeCountMin: 5, employeeCountMax: 10 }),
      plan,
      hiringScore: 80,
      vacancyCount: 1,
      vacancies: evidence,
      contact: {
        email: "hr@techflow.nl",
        isGeneralMailbox: false,
        recipientName: "HR",
        jobTitle: "HR Manager",
        contactId: null,
        roleLabel: null,
        confidence: 0.9,
        sourceType: "inferred",
        linkedinUrl: null,
        reliability: { level: "high", score: 90, factors: [], summary: "" },
        relevanceScore: 80,
        selectionReason: "",
        verificationStatus: "verified",
      },
      contactStage: "contact_found",
      desiredRoleMatch: true,
    });
    expect(result.reasonCode).toBe("employee_range_mismatch");
  });
});
