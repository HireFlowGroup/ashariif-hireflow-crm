import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  isJobLikeCareerTitle,
  isNonJobCareerLabel,
  parseCareersPageVacancies,
} from "@/features/ai-recruiter/services/careers-vacancy-parser.service";
import { assessParsedVacancies } from "@/features/ai-recruiter/services/company-vacancy-validation.service";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import { resolveVacancyAuditStatus } from "@/features/ai-recruiter/services/vacancy-audit-status.service";
import {
  createVacancyEvidence,
  hasConcreteJobUrl,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";
import {
  hasConcreteJobUrl as hasConcreteJobUrlFromUtil,
  isCareersListingPath,
} from "@/features/ai-recruiter/services/vacancy-url.validation";
import { validateDiscoveryCompanyForSave } from "@/features/company-finder/discovery/discovery-company-save-validation";
import { isGenericCompanyLabel } from "@/features/company-finder/discovery/generic-company-label";
import { evaluateEmployeeRangeConstraint } from "@/features/ai-recruiter/services/company-constraint-validation.service";

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
    employeeCountLabel: "20-200",
    priority: null,
    leadScore: null,
    leadPriority: null,
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

describe("root cause 1: concrete vacancy URL validation", () => {
  it("rejects careers listing pages", () => {
    expect(isCareersListingPath("/vacatures")).toBe(true);
    expect(isCareersListingPath("/careers")).toBe(true);
    expect(hasConcreteJobUrlFromUtil("https://itrconnect.nl/vacatures")).toBe(false);
    expect(hasConcreteJobUrl("https://digitalimpact.nl/nl/careers/")).toBe(false);
  });

  it("accepts job-specific detail URLs", () => {
    expect(hasConcreteJobUrl("https://bictgroep.nl/vacatures/cloud-engineer/")).toBe(true);
    expect(hasConcreteJobUrl("https://enigmatry.com/nl/careers/techlead/")).toBe(true);
  });

  it("rejects listing-only evidence", () => {
    const evidence = createVacancyEvidence({
      companyName: "Example BV",
      companyDomain: "example.nl",
      jobTitle: "Corporate Recruiter",
      jobUrl: "https://example.nl/vacatures",
      sourceUrl: "https://example.nl/vacatures",
      sourceType: "careers_page_crawl",
      desiredRoleMatch: true,
      validationReason: "test",
    });
    expect(strictVacancyEvidence(evidence)).toBe(false);
  });
});

describe("root cause 2: careers parser filters noise", () => {
  it("flags nav, CTA and language labels as non-job", () => {
    expect(isNonJobCareerLabel("Lees meer")).toBe(true);
    expect(isNonJobCareerLabel("Kennismaken?")).toBe(true);
    expect(isNonJobCareerLabel("English")).toBe(true);
    expect(isNonJobCareerLabel("Bekijk onze vacatures")).toBe(true);
  });

  it("accepts job-like titles", () => {
    expect(isJobLikeCareerTitle("Cloud Engineer")).toBe(true);
    expect(isJobLikeCareerTitle("Corporate Recruiter")).toBe(true);
  });

  it("parses only concrete job links from careers HTML", () => {
    const html = `
      <a href="/vacatures">Vacatures</a>
      <a href="/vacatures/cloud-engineer/">Cloud Engineer</a>
      <a href="/vacatures">Lees meer</a>
      <a href="/careers">English</a>
    `;
    const parsed = parseCareersPageVacancies(html, "https://techflow.nl/vacatures", "techflow.nl");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.title).toBe("Cloud Engineer");
    expect(parsed[0]?.url).toBe("https://techflow.nl/vacatures/cloud-engineer/");
  });
});

describe("root cause 3: generic company labels blocked at save", () => {
  it("rejects generic SEO company labels", () => {
    expect(validateDiscoveryCompanyForSave({
      name: "Software ontwikkelaar Rotterdam",
      domain: "digitalimpact.nl",
    }).acceptable).toBe(false);

    expect(validateDiscoveryCompanyForSave({
      name: "Software bedrijf Den Haag",
      domain: "example.nl",
    }).acceptable).toBe(false);
  });

  it("requires a credible domain", () => {
    expect(validateDiscoveryCompanyForSave({
      name: "TechFlow BV",
      domain: null,
      website: null,
    }).acceptable).toBe(false);
  });

  it("accepts identifiable brand with domain", () => {
    expect(validateDiscoveryCompanyForSave({
      name: "BICT Groep",
      domain: "bictgroep.nl",
    }).acceptable).toBe(true);
    expect(isGenericCompanyLabel("BICT Groep")).toBe(false);
  });
});

describe("root cause 4: vacancy audit status semantics", () => {
  it("reports none when no evidence exists", () => {
    expect(resolveVacancyAuditStatus({ vacancies: [], plan })).toBe("none");
  });

  it("reports noise for listing-only parse output", () => {
    const result = assessParsedVacancies({
      company: makeCompany(),
      plan,
      parsedVacancies: [
        { title: "Lees meer", url: "https://techflow.nl/vacatures", isActive: true, inactiveReason: null },
      ],
      evidenceSource: "careers_page_crawl",
    });
    expect(result.auditStatus).toBe("noise");
    expect(result.vacancies).toHaveLength(0);
  });

  it("reports no_matching_role for concrete but unrelated vacancy", () => {
    const result = assessParsedVacancies({
      company: makeCompany(),
      plan,
      parsedVacancies: [
        {
          title: "Cloud Engineer",
          url: "https://techflow.nl/vacatures/cloud-engineer/",
          isActive: true,
          inactiveReason: null,
        },
      ],
      evidenceSource: "careers_page_crawl",
    });
    expect(result.auditStatus).toBe("no_matching_role");
  });

  it("reports matched for concrete desired-role vacancy", () => {
    const result = assessParsedVacancies({
      company: makeCompany(),
      plan,
      parsedVacancies: [
        {
          title: "Corporate Recruiter",
          url: "https://techflow.nl/vacatures/corporate-recruiter/",
          isActive: true,
          inactiveReason: null,
        },
      ],
      evidenceSource: "careers_page_crawl",
    });
    expect(result.auditStatus).toBe("matched");
  });
});

describe("root cause 5: employee range unknown blocks qualification", () => {
  it("reports unknown when employee data is missing", () => {
    expect(
      evaluateEmployeeRangeConstraint(
        makeCompany({ employeeCountMin: null, employeeCountMax: null }),
        plan,
      ),
    ).toBe("unknown");
  });

  it("blocks eligibility when employee range is required but unknown", () => {
    const evidence = createVacancyEvidence({
      companyName: "TechFlow BV",
      companyDomain: "techflow.nl",
      jobTitle: "Corporate Recruiter",
      jobUrl: "https://techflow.nl/vacatures/corporate-recruiter/",
      sourceUrl: "https://techflow.nl/vacatures/corporate-recruiter/",
      sourceType: "careers_page_crawl",
      desiredRoleMatch: true,
      validationReason: "test",
    });

    const result = evaluateConceptEligibility({
      company: makeCompany({ employeeCountMin: null, employeeCountMax: null }),
      plan,
      hiringScore: 80,
      vacancyCount: 1,
      vacancies: [evidence],
      contact: {
        email: "hr@techflow.nl",
        isGeneralMailbox: true,
        recipientName: null,
        jobTitle: null,
        contactId: null,
        roleLabel: null,
        confidence: 0.8,
        sourceType: "inferred",
        linkedinUrl: null,
        reliability: { level: "high", score: 80, factors: [], summary: "" },
        relevanceScore: 60,
        selectionReason: "",
        verificationStatus: "likely",
      },
      contactStage: "contact_found",
      desiredRoleMatch: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("employee_range_unknown");
  });
});
