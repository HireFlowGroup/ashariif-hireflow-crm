import { describe, expect, it } from "vitest";

import type { Company } from "@/features/companies/domain";
import { toCompanyId } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { classifySearchResult } from "@/features/company-finder/discovery/result-classifier.service";
import {
  buildVacancyDrivenDiscoveryQueries,
  selectDiscoveryQueries,
} from "@/features/ai-recruiter/services/discovery-query-builder.service";
import { computeDeterministicLeadScore } from "@/features/ai-recruiter/services/deterministic-lead-score.service";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";

const basePlan: AiRecruiterSearchPlan = {
  locations: ["Rotterdam", "Den Haag"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["Recruiter", "Accountmanager", "Customer Success Manager"],
  vacancy_required: false,
  minimum_hiring_score: 30,
  minimum_opportunity_score: 30,
  maximum_companies: 25,
  maximum_drafts: 10,
  contact_roles: ["HR Manager", "Recruiter"],
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
    vacancyCount: 2,
    hiringSignals: [],
    careersUrl: "https://techflow.nl/werken-bij",
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

function makeContact(overrides: Partial<SelectedDiscoveredContact> = {}): SelectedDiscoveredContact {
  return {
    contactId: "contact-1",
    email: "recruitment@techflow.nl",
    recipientName: null,
    jobTitle: null,
    linkedinUrl: null,
    sourceType: "inferred",
    verificationStatus: "likely",
    relevanceScore: 65,
    confidence: 0.7,
    isGeneralMailbox: true,
    roleLabel: "Algemene mailbox",
    reliability: {
      level: "medium",
      score: 60,
      summary: "MX geldig",
      factors: [],
    },
    selectionReason: "Fallback mailbox",
    ...overrides,
  };
}

const activeVacancy: VacancyEvidence = {
  title: "Recruiter",
  companyName: "TechFlow BV",
  location: "Rotterdam",
  sourceUrl: "https://techflow.nl/vacatures/recruiter",
  sourceDomain: "techflow.nl",
  publishedAt: null,
  validThrough: null,
  employmentType: null,
  department: null,
  hiringSignalStrength: 80,
  isActive: true,
  validationReason: "Actieve vacature",
  actuality: "unknown",
};

describe("concept eligibility pipeline", () => {
  it("1. bedrijf met vacature en recruitment@ krijgt concept", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: basePlan,
      hiringScore: 60,
      vacancyCount: 2,
      vacancies: [activeVacancy],
      contact: makeContact({ email: "recruitment@techflow.nl" }),
      contactStage: "general_mailbox_found",
    });
    expect(result.eligible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it("2. bedrijf met vacature en info@ krijgt concept bij score ≥ 30", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: basePlan,
      hiringScore: 55,
      vacancyCount: 1,
      vacancies: [activeVacancy],
      contact: makeContact({ email: "info@techflow.nl" }),
      contactStage: "general_mailbox_found",
    });
    expect(result.eligible).toBe(true);
  });

  it("3. bedrijf met vacature maar geen e-mail krijgt geen concept", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: basePlan,
      hiringScore: 60,
      vacancyCount: 1,
      vacancies: [activeVacancy],
      contact: null,
      contactStage: "blocked_missing_contact",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("no_contact");
  });

  it("4. persoonlijk recruitercontact krijgt hogere score dan info@", () => {
    const personal = computeDeterministicLeadScore({
      company: makeCompany(),
      plan: basePlan,
      vacancies: [activeVacancy],
      vacancyCount: 1,
      hiringScore: 50,
      contact: makeContact({
        email: "jane@techflow.nl",
        isGeneralMailbox: false,
        recipientName: "Jane Doe",
        jobTitle: "Recruiter",
      }),
      desiredRoleMatch: true,
    });
    const info = computeDeterministicLeadScore({
      company: makeCompany(),
      plan: basePlan,
      vacancies: [activeVacancy],
      vacancyCount: 1,
      hiringScore: 50,
      contact: makeContact({ email: "info@techflow.nl" }),
      desiredRoleMatch: true,
    });
    expect(personal.breakdown.contactability).toBeGreaterThan(info.breakdown.contactability);
  });

  it("5. vacancy-boardtitel wordt niet als bedrijf opgeslagen", () => {
    const result = classifySearchResult({
      title: "Customer Success Manager in Netherlands",
      url: "https://nl.indeed.com/viewjob?jk=abc",
    });
    expect(["vacancy", "vacancy_board"]).toContain(result.resultType);
    expect(result.shouldSaveAsCompany).toBe(false);
  });

  it("6. vacature wordt herkend als vacancy type", () => {
    const result = classifySearchResult({
      title: "Accountmanager SaaS — TechFlow",
      url: "https://www.linkedin.com/jobs/view/123",
      description: "TechFlow zoekt accountmanager",
    });
    expect(["vacancy", "vacancy_board"]).toContain(result.resultType);
    expect(result.shouldSaveAsCompany).toBe(false);
  });

  it("7. directorypagina wordt afgewezen", () => {
    const result = classifySearchResult({
      title: "Top 100 softwarebedrijven Rotterdam",
      url: "https://example.com/top-100-software-rotterdam",
    });
    expect(result.resultType).toBe("directory");
    expect(result.shouldSaveAsCompany).toBe(false);
  });

  it("8. score onder drempel toont exacte afwijsreden", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany({ vacancyCount: 0, careersUrl: null, city: "Groningen" }),
      plan: basePlan,
      hiringScore: 5,
      vacancyCount: 0,
      vacancies: [],
      contact: makeContact(),
      contactStage: "general_mailbox_found",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("score_below_threshold");
    expect(result.userMessage).toContain("drempel");
  });

  it("9. algemene mailbox wordt niet automatisch afgewezen", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: basePlan,
      hiringScore: 50,
      vacancyCount: 1,
      vacancies: [activeVacancy],
      contact: makeContact({ email: "hr@techflow.nl" }),
      contactStage: "general_mailbox_found",
    });
    expect(result.acceptedRules).toContain("relevant_general_mailbox");
    expect(result.eligible).toBe(true);
  });

  it("10. eligible prospect heeft reasonCode eligible", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: basePlan,
      hiringScore: 50,
      vacancyCount: 1,
      vacancies: [activeVacancy],
      contact: makeContact(),
      contactStage: "general_mailbox_found",
    });
    expect(result.reasonCode).toBe("eligible");
  });

  it("11. duplicate outreach wordt geblokkeerd", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: basePlan,
      hiringScore: 50,
      vacancyCount: 1,
      vacancies: [activeVacancy],
      contact: makeContact(),
      contactStage: "general_mailbox_found",
      duplicateOutreach: true,
    });
    expect(result.reasonCode).toBe("duplicate_outreach");
  });

  it("12. manual override genereert eligible", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany({ vacancyCount: 0 }),
      plan: basePlan,
      hiringScore: 0,
      vacancyCount: 0,
      vacancies: [],
      contact: null,
      contactStage: "blocked_missing_contact",
      manualEligibilityOverride: true,
    });
    expect(result.eligible).toBe(true);
    expect(result.reasonCode).toBe("manual_override");
  });

  it("13. discovery queries bevatten minimaal 12 varianten", () => {
    const queries = selectDiscoveryQueries(
      buildVacancyDrivenDiscoveryQueries(
      {
        city: "Rotterdam",
        sector: "software",
        locations: ["Rotterdam", "Den Haag"],
        desiredRoles: ["Recruiter"],
        maxResults: 25,
      },
      basePlan,
      ),
    );
    expect(queries.length).toBeGreaterThanOrEqual(12);
    expect(queries.some((q) => q.query.includes("indeed"))).toBe(true);
    expect(queries.some((q) => q.query.includes("vacatures"))).toBe(true);
    expect(queries.some((q) => q.intent === "company_discovery")).toBe(true);
  });

  it("14. no-results onderscheiden van providerfout via classify unknown", () => {
    const result = classifySearchResult({ title: "", url: "" });
    expect(result.resultType).toBe("unknown");
    expect(result.shouldSaveAsCompany).toBe(false);
  });

  it("15. actieve vacature zonder publicatiedatum blijft eligible", () => {
    const vacancy: VacancyEvidence = { ...activeVacancy, publishedAt: null, actuality: "unknown" };
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: basePlan,
      hiringScore: 40,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact: makeContact(),
      contactStage: "general_mailbox_found",
    });
    expect(result.eligible).toBe(true);
  });

  it("16. irrelevant bedrijf buiten regio krijgt lagere score", () => {
    const score = computeDeterministicLeadScore({
      company: makeCompany({ city: "Groningen", region: "Groningen" }),
      plan: basePlan,
      vacancies: [activeVacancy],
      vacancyCount: 1,
      hiringScore: 40,
      contact: makeContact(),
      desiredRoleMatch: false,
    });
    expect(score.rejectedRules).toContain("wrong_location");
  });

  it("17. careers page wordt als company_careers_page geclassificeerd", () => {
    const result = classifySearchResult({
      title: "TechFlow — Werken bij",
      url: "https://techflow.nl/werken-bij",
    });
    expect(result.resultType).toBe("company_careers_page");
    expect(result.shouldSaveAsCompany).toBe(true);
  });

  it("18. suppressed contact wordt geblokkeerd", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: basePlan,
      hiringScore: 50,
      vacancyCount: 1,
      vacancies: [activeVacancy],
      contact: makeContact(),
      contactStage: "general_mailbox_found",
      suppressedContact: true,
    });
    expect(result.reasonCode).toBe("suppressed_contact");
  });

  it("19. vacancy_required blokkeert zonder vacature", () => {
    const result = evaluateConceptEligibility({
      company: makeCompany({ vacancyCount: 0, careersUrl: null }),
      plan: { ...basePlan, vacancy_required: true },
      hiringScore: 10,
      vacancyCount: 0,
      vacancies: [],
      contact: makeContact(),
      contactStage: "general_mailbox_found",
    });
    expect(result.reasonCode).toBe("no_active_vacancy");
  });

  it("20. software vacatures rotterdam titel is directory of vacancy, geen bedrijf", () => {
    const result = classifySearchResult({
      title: "Software vacatures Rotterdam",
      url: "https://example.com/software-vacatures-rotterdam",
    });
    expect(result.shouldSaveAsCompany).toBe(false);
  });
});
