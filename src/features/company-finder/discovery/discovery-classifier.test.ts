import { describe, expect, it } from "vitest";

import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  buildVacancyDrivenDiscoveryQueries,
  selectDiscoveryQueries,
} from "@/features/ai-recruiter/services/discovery-query-builder.service";
import {
  classifyDiscoveryResult,
  classifySearchResult,
} from "@/features/company-finder/discovery/result-classifier.service";
import { validateOfficialDomain } from "@/features/company-finder/discovery/official-domain.service";
import { detectRecruitmentCompetitor } from "@/features/company-finder/discovery/competitor-detection.service";
import { extractEmployerFromVacancy } from "@/features/company-finder/discovery/employer-extraction.service";
import {
  evaluateDiscoveryBenchmark,
  ROTTERDAM_DEN_HAAG_SOFTWARE_REFERENCE,
} from "@/features/company-finder/discovery/discovery-benchmark";

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
  contact_roles: ["HR Manager"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "",
};

const criteria: CompanySearchCriteria = {
  city: "Rotterdam",
  sector: "software",
  locations: ["Rotterdam", "Den Haag"],
  desiredRoles: ["Recruiter", "Accountmanager", "Customer Success Manager"],
  maxResults: 25,
};

describe("discovery classifier and pipeline", () => {
  it("1. vacaturetitel wordt niet als bedrijf opgeslagen", () => {
    const result = classifyDiscoveryResult({
      title: "Customer Success Manager in Rotterdam",
      url: "https://example.com/job/csm-rotterdam",
    });
    expect(result.shouldSaveAsCompany).toBe(false);
    expect(result.resultType).toBe("individual_vacancy");
  });

  it("2. directory wordt afgewezen", () => {
    const result = classifyDiscoveryResult({
      title: "Software bedrijven in Rotterdam",
      url: "https://company.info/software-rotterdam",
    });
    expect(result.shouldSaveAsCompany).toBe(false);
    expect(["business_directory", "list_article"]).toContain(result.resultType);
  });

  it("3. list article wordt afgewezen", () => {
    const result = classifyDiscoveryResult({
      title: "Top 10 software bedrijven Rotterdam",
      url: "https://blog.example.com/top-10",
    });
    expect(result.shouldSaveAsCompany).toBe(false);
    expect(result.resultType).toBe("list_article");
  });

  it("4. recruitmentbureau wordt als concurrent uitgesloten", () => {
    const result = classifyDiscoveryResult({
      title: "IT Recruitment Specialists in the Netherlands",
      url: "https://example.com/recruitment-specialists",
    });
    expect(result.excludedCompetitor).toBe(true);
    expect(result.shouldSaveAsCompany).toBe(false);
    expect(result.resultType).toBe("recruitment_agency");
  });

  it("5. vacancy board met werkgever in titel wordt gekoppeld", () => {
    const extracted = extractEmployerFromVacancy({
      title: "Customer Success Manager at Betabit",
      url: "https://indeed.nl/viewjob?id=123",
      description: "Betabit zoekt een Customer Success Manager in Rotterdam",
    });
    expect(extracted.employerName).toBe("Betabit");
  });

  it("6. officiële bedrijfswebsite wordt gevonden", () => {
    const domain = validateOfficialDomain({
      companyName: "Betabit",
      url: "https://www.betabit.nl/over-ons",
    });
    expect(domain.officialDomain).toBe("betabit.nl");
    expect(domain.domainConfidence).toBeGreaterThan(0.6);
  });

  it("7. onbekende bedrijfsgrootte blokkeert niet via classifier", () => {
    const result = classifyDiscoveryResult({
      title: "Enable U",
      url: "https://enableu.nl",
    });
    expect(result.shouldSaveAsCompany).toBe(true);
  });

  it("8. actieve vacature zonder datum blijft classificeerbaar", () => {
    const result = classifyDiscoveryResult({
      title: "Recruiter | DEPT",
      url: "https://deptagency.com/careers/recruiter",
      description: "DEPT is hiring a Recruiter",
    });
    expect(result.employerName).toBeTruthy();
  });

  it("9. meerdere queries worden gegenereerd (minimaal 12)", () => {
    const queries = selectDiscoveryQueries(
      buildVacancyDrivenDiscoveryQueries(criteria, basePlan),
    );
    expect(queries.length).toBeGreaterThanOrEqual(12);
    expect(queries.some((q) => q.intent === "company_discovery")).toBe(true);
    expect(queries.some((q) => q.intent === "vacancy_source")).toBe(true);
  });

  it("10. queryvarianten zijn uniek", () => {
    const queries = buildVacancyDrivenDiscoveryQueries(criteria, basePlan);
    const keys = queries.map((q) => q.query.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("11. iedere afwijzing heeft impliciete reden via classifyDiscoveryResult", () => {
    const rejected = classifyDiscoveryResult({
      title: "Top 5 IT companies in Netherlands",
      url: "https://example.com/top-5",
    });
    expect(rejected.shouldSaveAsCompany).toBe(false);
    expect(rejected.classificationReason.length).toBeGreaterThan(0);
  });

  it("12. classifier onderscheidt company van vacancy", () => {
    const company = classifyDiscoveryResult({
      title: "Yellow Yard",
      url: "https://yellowyard.nl",
    });
    const vacancy = classifyDiscoveryResult({
      title: "Account Manager in Den Haag",
      url: "https://indeed.nl/viewjob?id=1",
    });
    expect(company.resultType).toBe("official_company_site");
    expect(vacancy.resultType).not.toBe("official_company_site");
  });

  it('13. "IT Recruitment Specialists in the Netherlands" wordt niet als bedrijfsnaam opgeslagen', () => {
    const legacy = classifySearchResult({
      title: "IT Recruitment Specialists in the Netherlands",
      url: "https://example.com/it-recruitment",
    });
    expect(legacy.shouldSaveAsCompany).toBe(false);
    expect(legacy.employerName).toBeNull();
  });

  it("14. benchmark injecteert geen productiedata", () => {
    const report = evaluateDiscoveryBenchmark({
      acceptedCompanies: [],
      rejectedCompanies: [],
    });
    expect(report.referenceCount).toBe(ROTTERDAM_DEN_HAAG_SOFTWARE_REFERENCE.length);
    expect(report.foundCount).toBe(0);
  });

  it("15. providerfout bij één query stopt andere queries niet (concurrency helper)", async () => {
    const { runWithConcurrencySettled } = await import("@/lib/async/run-with-concurrency-settled");
    const results = await runWithConcurrencySettled(
      [
        async () => "ok",
        async () => {
          throw new Error("provider timeout");
        },
        async () => "ok2",
      ],
      2,
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("16. funnel-rapportage telt saved en rejected", () => {
    const report = evaluateDiscoveryBenchmark({
      acceptedCompanies: [
        { name: "Betabit", domain: "betabit.nl", hasVacancyEvidence: true },
        { name: "Random Corp", domain: "random.nl", hasVacancyEvidence: false },
      ],
      rejectedCompanies: [{ name: "IT Recruitment Specialists", reason: "competitor" }],
    });
    expect(report.foundCount).toBe(1);
    expect(report.recall).toBeGreaterThan(0);
  });

  it("17. recruiter/staffingbedrijf wordt uitgesloten", () => {
    const check = detectRecruitmentCompetitor({
      title: "Robert Half Recruitment",
      url: "https://roberthalf.nl",
    });
    expect(check.isCompetitor).toBe(true);
  });

  it("18. echte softwareorganisatie in juiste regio wordt geaccepteerd", () => {
    const result = classifyDiscoveryResult({
      title: "Simac IT",
      url: "https://simac.com/nl",
      description: "Software en IT diensten Den Haag",
    });
    expect(result.shouldSaveAsCompany).toBe(true);
    expect(result.resultType).toBe("official_company_site");
  });

  it("19. AI kan geen bedrijf zonder bron toevoegen via unknown type", () => {
    const result = classifyDiscoveryResult({
      title: "",
      url: "https://example.com",
    });
    expect(result.resultType).toBe("unknown");
    expect(result.shouldSaveAsCompany).toBe(false);
  });

  it("20. officiële careerspagina levert company_careers_page", () => {
    const result = classifyDiscoveryResult({
      title: "Bluetick — Werken bij",
      url: "https://bluetick.nl/werken-bij",
    });
    expect(result.resultType).toBe("company_careers_page");
    expect(result.shouldSaveAsCompany).toBe(true);
  });
});
