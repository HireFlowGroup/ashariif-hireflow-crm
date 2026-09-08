import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  discoverCareersPageUrls,
  parseCareersPageVacancies,
} from "@/features/ai-recruiter/services/careers-vacancy-parser.service";
import { assessParsedVacancies } from "@/features/ai-recruiter/services/company-vacancy-validation.service";
import {
  vacancyTitleMatchesDesiredRoles,
} from "@/features/ai-recruiter/services/desired-role-matching.service";
import {
  buildVacancyEvidenceFromCompany,
  isGenericVacancyTitle,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";

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

const homepageWithoutVacancies = `
  <html><body>
    <a href="/over-ons">Over ons</a>
    <a href="/contact">Contact</a>
    <h1>Software bedrijf Rotterdam</h1>
  </body></html>
`;

const careersWithoutOpenRoles = `
  <html><body>
    <h1>Werken bij TechFlow</h1>
    <p>Momenteel geen openstaande vacatures.</p>
  </body></html>
`;

const careersWithWrongRole = `
  <html><body>
    <h1>Vacatures</h1>
    <a href="/vacatures/backend-developer">Backend Developer</a>
    <a href="/vacatures/digital-project-manager">Digital Project Manager</a>
  </body></html>
`;

const careersWithRecruiter = `
  <html><body>
    <h1>Careers</h1>
    <a href="/vacatures/corporate-recruiter">Corporate Recruiter</a>
  </body></html>
`;

const careersWithAccountManager = `
  <html><body>
    <a href="/jobs/account-manager-rotterdam">Account Manager Rotterdam</a>
  </body></html>
`;

const careersWithCustomerSuccess = `
  <html><body>
    <a href="/careers/customer-success-manager">Customer Success Manager</a>
  </body></html>
`;

describe("desired role matching", () => {
  it("matches recruiter variants", () => {
    expect(vacancyTitleMatchesDesiredRoles("Corporate Recruiter", plan)).toBe(true);
    expect(vacancyTitleMatchesDesiredRoles("Talent Acquisition Specialist", plan)).toBe(true);
  });

  it("matches accountmanager variants", () => {
    expect(vacancyTitleMatchesDesiredRoles("Account Manager Rotterdam", plan)).toBe(true);
  });

  it("matches customer success variants", () => {
    expect(vacancyTitleMatchesDesiredRoles("Customer Success Manager", plan)).toBe(true);
    expect(vacancyTitleMatchesDesiredRoles("Client Success Lead", plan)).toBe(true);
  });

  it("rejects unrelated technical roles", () => {
    expect(vacancyTitleMatchesDesiredRoles("Backend Developer", plan)).toBe(false);
    expect(vacancyTitleMatchesDesiredRoles("Medior Apple Systeembeheerder", plan)).toBe(false);
  });
});

describe("careers vacancy parser", () => {
  it("finds careers page urls from homepage signals", () => {
    const html = `<a href="/nl/careers">Vacatures</a>`;
    const urls = discoverCareersPageUrls(html, "https://digitalimpact.nl");
    expect(urls.some((url) => url.includes("/careers"))).toBe(true);
  });

  it("does not treat generic vacatures text as vacancy title", () => {
    expect(isGenericVacancyTitle("vacatures")).toBe(true);
    expect(isGenericVacancyTitle("Careers pagina")).toBe(true);
  });
});

describe("assessParsedVacancies", () => {
  it("rejects homepage without vacancy listings", () => {
    const parsed = parseCareersPageVacancies(homepageWithoutVacancies, "https://techflow.nl", "techflow.nl");
    const result = assessParsedVacancies({
      company: makeCompany(),
      plan,
      parsedVacancies: parsed,
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("no_active_vacancy");
  });

  it("rejects careers page without open vacancies", () => {
    const parsed = parseCareersPageVacancies(careersWithoutOpenRoles, "https://techflow.nl/careers", "techflow.nl");
    const result = assessParsedVacancies({
      company: makeCompany({ careersUrl: "https://techflow.nl/careers" }),
      plan,
      parsedVacancies: parsed,
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("no_active_vacancy");
  });

  it("rejects active vacancy with wrong role", () => {
    const parsed = parseCareersPageVacancies(careersWithWrongRole, "https://techflow.nl/vacatures", "techflow.nl");
    const result = assessParsedVacancies({
      company: makeCompany(),
      plan,
      parsedVacancies: parsed,
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("no_matching_role");
    expect(result.vacancies.length).toBeGreaterThan(0);
  });

  it("accepts active recruiter vacancy", () => {
    const parsed = parseCareersPageVacancies(careersWithRecruiter, "https://techflow.nl/vacatures", "techflow.nl");
    const result = assessParsedVacancies({
      company: makeCompany(),
      plan,
      parsedVacancies: parsed,
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("accepted");
    expect(result.vacancies[0]?.jobTitle).toContain("Recruiter");
    expect(result.vacancies[0]?.jobUrl).toContain("corporate-recruiter");
  });

  it("accepts active accountmanager vacancy", () => {
    const parsed = parseCareersPageVacancies(
      careersWithAccountManager,
      "https://techflow.nl/jobs",
      "techflow.nl",
    );
    const result = assessParsedVacancies({
      company: makeCompany(),
      plan,
      parsedVacancies: parsed,
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("accepted");
    expect(result.vacancies[0]?.title).toContain("Account Manager");
  });

  it("accepts active customer success vacancy", () => {
    const parsed = parseCareersPageVacancies(
      careersWithCustomerSuccess,
      "https://techflow.nl/careers",
      "techflow.nl",
    );
    const result = assessParsedVacancies({
      company: makeCompany(),
      plan,
      parsedVacancies: parsed,
      evidenceSource: "careers_page_crawl",
    });
    expect(result.status).toBe("accepted");
    expect(result.vacancies[0]?.title).toContain("Customer Success Manager");
  });
});

describe("buildVacancyEvidenceFromCompany strictness", () => {
  it("does not create evidence from generic vacatures signal summary", () => {
    const evidence = buildVacancyEvidenceFromCompany(
      makeCompany({
        discoveryReason: "url_category:company | homepage_signals:8 | overOns, contact, vacatures, linkedin",
        careersUrl: "https://techflow.nl/careers",
        vacancyCount: 0,
      }),
      plan,
    );
    expect(evidence).toEqual([]);
  });
});
