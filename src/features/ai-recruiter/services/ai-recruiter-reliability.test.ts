import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  evaluateEmployeeRangeConstraint,
  evaluateLocationConstraint,
} from "@/features/ai-recruiter/services/company-constraint-validation.service";
import {
  contactEmailMatchesCompanyDomain,
  selectContactWithMatchingDomain,
} from "@/features/ai-recruiter/services/contact-domain-validation.service";
import { buildDeterministicOutreachFallback } from "@/features/ai-recruiter/services/deterministic-outreach-fallback.service";
import { evaluateOutreachReadiness } from "@/features/ai-recruiter/services/evaluate-outreach-readiness.service";
import { desiredRoleMatchesVacancy } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import {
  buildVacancyEvidenceFromCompany,
  createVacancyEvidence,
  hasConcreteJobUrl,
  isGenericVacancyTitle,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { isGenericCompanyLabel } from "@/features/company-finder/discovery/generic-company-label";

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
    discoveryReason: "url_category:company | homepage_signals:8 | overOns, contact, vacatures, linkedin",
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

function makeEvidence(overrides: Partial<ReturnType<typeof createVacancyEvidence>> = {}) {
  return createVacancyEvidence({
    companyName: "TechFlow BV",
    companyDomain: "techflow.nl",
    jobTitle: "Corporate Recruiter",
    jobUrl: "https://techflow.nl/vacatures/corporate-recruiter",
    sourceUrl: "https://techflow.nl/vacatures/corporate-recruiter",
    sourceType: "careers_page_crawl",
    location: "Rotterdam",
    desiredRoleMatch: true,
    validationReason: "careers_page_crawl: Actieve vacature",
    ...overrides,
  });
}

describe("synthetic vacancy evidence removed", () => {
  it("homepage with vacatures nav produces no vacancy evidence", () => {
    const evidence = buildVacancyEvidenceFromCompany(
      makeCompany({
        discoveryReason: "url_category:company | homepage_signals:8 | overOns, contact, vacatures, linkedin",
        careersUrl: "https://techflow.nl/careers",
      }),
      plan,
    );
    expect(evidence).toEqual([]);
  });

  it("careers link without concrete jobs produces no vacancy evidence", () => {
    const evidence = buildVacancyEvidenceFromCompany(makeCompany({ careersUrl: "https://techflow.nl/careers" }), plan);
    expect(evidence).toEqual([]);
  });

  it("treats bare desired role as generic title", () => {
    expect(isGenericVacancyTitle("recruiters")).toBe(true);
    expect(desiredRoleMatchesVacancy("recruiters", plan)).toBe(false);
  });

  it("rejects careers listing URL as vacancy evidence", () => {
    expect(hasConcreteJobUrl("https://techflow.nl/vacatures")).toBe(false);
    expect(hasConcreteJobUrl("https://techflow.nl/careers")).toBe(false);
  });

  it("accepts job detail URL as vacancy evidence", () => {
    expect(hasConcreteJobUrl("https://techflow.nl/vacatures/corporate-recruiter")).toBe(true);
  });

  it("rejects homepage-only URL as vacancy evidence", () => {
    const evidence = makeEvidence({
      jobTitle: "Corporate Recruiter",
      jobUrl: "https://techflow.nl/",
      sourceUrl: "https://techflow.nl/",
    });
    expect(hasConcreteJobUrl(evidence.jobUrl)).toBe(false);
    expect(strictVacancyEvidence(evidence)).toBe(false);
  });
});

describe("role matching", () => {
  it("accepts concrete recruiter vacancy", () => {
    expect(desiredRoleMatchesVacancy("Corporate Recruiter", plan)).toBe(true);
  });

  it("accepts accountmanager vacancy", () => {
    expect(desiredRoleMatchesVacancy("Account Manager Rotterdam", plan)).toBe(true);
  });

  it("accepts customer success vacancy", () => {
    expect(desiredRoleMatchesVacancy("Customer Success Manager", plan)).toBe(true);
  });

  it("rejects unrelated role", () => {
    expect(desiredRoleMatchesVacancy("Backend Developer", plan)).toBe(false);
  });
});

describe("company constraint validation", () => {
  it("reports employee range unknown when data is missing", () => {
    expect(evaluateEmployeeRangeConstraint(makeCompany({ employeeCountMin: null, employeeCountMax: null }), plan)).toBe(
      "unknown",
    );
  });

  it("reports employee range matched when data fits", () => {
    expect(evaluateEmployeeRangeConstraint(makeCompany(), plan)).toBe("matched");
  });

  it("reports location mismatch for wrong city", () => {
    expect(
      evaluateLocationConstraint(makeCompany({ city: "Amsterdam" }), plan),
    ).toBe("mismatched");
  });
});

describe("generic company and contact domain", () => {
  it("rejects generic pseudo company labels", () => {
    expect(isGenericCompanyLabel("Software ontwikkelaar Rotterdam")).toBe(true);
  });

  it("rejects contact on unrelated domain", () => {
    expect(contactEmailMatchesCompanyDomain("recruitment@amandlaconsulting.co.za", "blokes.nl")).toBe(false);
  });

  it("selects alternative contact on matching domain", () => {
    const result = selectContactWithMatchingDomain({
      selected: {
        email: "recruitment@wrong.co.za",
        isGeneralMailbox: true,
        recipientName: null,
        jobTitle: null,
        contactId: null,
        roleLabel: null,
        confidence: 0.5,
        sourceType: "tavily_search",
        linkedinUrl: null,
        reliability: { level: "low", score: 40, factors: [], summary: "" },
        relevanceScore: 50,
        selectionReason: "",
        verificationStatus: "likely",
      },
      alternatives: [
        {
          email: "recruitment@techflow.nl",
          isGeneralMailbox: true,
          recipientName: null,
          jobTitle: null,
          contactId: null,
          roleLabel: null,
          confidence: 0.5,
          sourceType: "inferred",
          linkedinUrl: null,
          reliability: { level: "high", score: 80, factors: [], summary: "" },
          relevanceScore: 60,
          selectionReason: "",
          verificationStatus: "likely",
        },
      ],
      companyDomain: "techflow.nl",
    });
    expect(result.invalidContact).toBe(false);
    expect(result.contact?.email).toBe("recruitment@techflow.nl");
  });
});

describe("outreach grounding", () => {
  it("blocks concept hiring claim without VacancyEvidence", () => {
    const draft = buildDeterministicOutreachFallback({
      company: makeCompany(),
      vacancies: [],
      recipientEmail: "hr@techflow.nl",
      recipientName: null,
      isGeneralMailbox: true,
    });
    expect(draft.blocked).toBe(true);
    expect(draft.personalizationFacts).toEqual([]);
  });

  it("allows concept with concrete evidence", () => {
    const evidence = makeEvidence();
    const draft = buildDeterministicOutreachFallback({
      company: makeCompany(),
      vacancies: [evidence],
      recipientEmail: "hr@techflow.nl",
      recipientName: null,
      isGeneralMailbox: true,
    });
    expect(draft.blocked).toBe(false);
    expect(draft.sourceEvidence[0]?.sourceUrl).toBe(evidence.jobUrl);
    expect(draft.personalizationFacts[0]?.claim).toContain("Corporate Recruiter");
  });

  it("blocks outreach readiness without strict vacancy evidence", () => {
    const readiness = evaluateOutreachReadiness({
      companyId: "co-1",
      companyName: "TechFlow BV",
      isCompetitor: false,
      isGenericIdentity: false,
      score: 70,
      decision: "priority_b",
      threshold: 30,
      eligible: true,
      contactEmail: "hr@techflow.nl",
      contactId: null,
      isGeneralMailbox: true,
      contactVerificationStatus: "likely",
      duplicateOutreach: false,
      cooldownActive: false,
      suppressedContact: false,
      bouncedContact: false,
      invalidContact: false,
      hasVacancyEvidence: false,
      vacancies: [],
      hiringSignalCount: 2,
      reasonCode: "eligible",
      userMessage: "ok",
      vacancyId: null,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.blockingReasons).toContain("no_vacancy_evidence");
  });
});
