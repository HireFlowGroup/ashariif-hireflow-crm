import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import {
  applyCommercialRelevanceGate,
  resolveQualificationThresholds,
} from "@/features/ai-recruiter/services/qualification-contract.service";

const commercialPlan: AiRecruiterSearchPlan = {
  locations: ["Rotterdam"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["Recruiter"],
  vacancy_required: false,
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

describe("qualification contract P0-R1", () => {
  it("documents separate responsibilities for plan-70 vs concept-30", () => {
    const thresholds = resolveQualificationThresholds(commercialPlan);
    const config = getAiRecruiterConfig();

    expect(thresholds.commercialHiringMin).toBe(70);
    expect(thresholds.commercialOpportunityMin).toBe(70);
    expect(thresholds.conceptReadinessMin).toBe(config.conceptScoreThreshold);
    expect(thresholds.conceptReadinessMin).toBe(30);
    expect(thresholds.responsibilityNotes.commercial_hiring).toMatch(/commerciële/i);
    expect(thresholds.responsibilityNotes.concept_readiness).toMatch(/conceptgeneratie/i);
  });

  it("blocks concept when commercial scores are below plan minimum even if prospectscore passes", () => {
    const gate = applyCommercialRelevanceGate({
      plan: commercialPlan,
      hiringScore: 25,
      opportunityScore: 20,
      leadScore: 45,
      conceptThreshold: 30,
      priority: "priority_c",
      acceptedRules: [],
      rejectedRules: [],
    });

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.reasonCode).toBe("commercial_hiring_below_plan");
    }
  });

  it("attaches contract snapshot on eligibility evaluation", () => {
    const { makeCompany, makeContact, activeVacancy } = eligibilityFixtures();
    const result = evaluateConceptEligibility({
      company: makeCompany(),
      plan: commercialPlan,
      hiringScore: 75,
      opportunityScore: 80,
      vacancyCount: 1,
      vacancies: [activeVacancy],
      contact: makeContact(),
      contactStage: "general_mailbox_found",
    });

    expect(result.contract?.version).toBe("p0-r2-v1");
    expect(result.contract?.thresholds.conceptReadinessMin).toBe(30);
    expect(result.contract?.commercial.hiringThreshold).toBe(70);
    expect(result.userMessage).toMatch(/conceptdrempel|prospectscore/i);
  });
});

function eligibilityFixtures() {
  const makeCompany = () =>
    ({
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
      employeeCountMin: 50,
      employeeCountMax: 120,
      employeeCountLabel: "51-200",
      priority: null,
      leadScore: null,
      leadPriority: null,
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
      source: "tavily",
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
    }) as import("@/features/companies/domain").Company;

  const makeContact = () =>
    ({
      contactId: "c1",
      email: "recruitment@techflow.nl",
      recipientName: null,
      jobTitle: "Recruiter",
      linkedinUrl: null,
      sourceType: "inferred",
      verificationStatus: "likely",
      relevanceScore: 70,
      confidence: 0.8,
      isGeneralMailbox: false,
      roleLabel: "Recruiter",
      reliability: { level: "high", score: 80, summary: "ok", factors: [] },
      selectionReason: "match",
    }) as import("@/features/contact-finder/services/contact-validation.service").SelectedDiscoveredContact;

  const activeVacancy = {
    companyName: "TechFlow BV",
    companyDomain: "techflow.nl",
    jobTitle: "Recruiter",
    jobUrl: "https://techflow.nl/jobs/recruiter",
    sourceUrl: "https://techflow.nl/jobs/recruiter",
    sourceType: "careers_page_crawl" as const,
    location: "Rotterdam",
    observedAt: new Date().toISOString(),
    activeStatus: "active" as const,
    desiredRoleMatch: true,
    title: "Recruiter",
    sourceDomain: "techflow.nl",
    publishedAt: null,
    validThrough: null,
    employmentType: null,
    department: null,
    hiringSignalStrength: 70,
    isActive: true,
    validationReason: "ok",
    actuality: "known" as const,
  };

  return { makeCompany, makeContact, activeVacancy };
}