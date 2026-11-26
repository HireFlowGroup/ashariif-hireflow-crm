import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  contactEmailMatchesCompanyDomain,
  registrableDomain,
} from "@/features/ai-recruiter/services/contact-domain-validation.service";
import { evaluateEmployeeRangeConstraint, resolveCompanyEmployeeRangeBounds } from "@/features/ai-recruiter/services/company-constraint-validation.service";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import { computeOpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import {
  deriveProspectLifecycle,
  isProspectDraftCapable,
} from "@/features/ai-recruiter/services/prospect-lifecycle.service";
import {
  createVacancyEvidence,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";

const LAURENS_VACANCY = "https://werkenbij.laurens.nl/vacature/corporate-recruiter/";

const plan: AiRecruiterSearchPlan = {
  locations: ["Nederland"],
  regions: [],
  sectors: ["zorg"],
  employee_range: { min: 20, max: 500 },
  desired_roles: ["Corporate Recruiter"],
  vacancy_required: true,
  minimum_hiring_score: 70,
  minimum_opportunity_score: 70,
  maximum_companies: 1,
  maximum_drafts: 1,
  contact_roles: ["HR Manager"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "Laurens commercial intelligence",
};

function laurensCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("laurens-1"),
    organizationId: "org",
    ownerId: null,
    name: "Laurens",
    website: "https://werkenbij.laurens.nl",
    domain: "werkenbij.laurens.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "zorg",
    city: "Rotterdam",
    region: null,
    province: null,
    country: "NL",
    employeeCount: null,
    employeeCountMin: null,
    employeeCountMax: null,
    employeeCountLabel: "Bewijs in bron: 250-500 medewerkers",
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
        source: "serpapi",
        confidence: 0.9,
      },
    ],
    careersUrl: null,
    vacancyPageUrl: LAURENS_VACANCY,
    generalEmail: "recruitment@laurens.nl",
    hrEmail: null,
    kvkNumber: null,
    aiSummary: null,
    source: "serpapi",
    sourceUrl: LAURENS_VACANCY,
    confidence: 0.85,
    companyType: null,
    companyConfidence: null,
    discoveryReason: null,
    discoveryProvider: null,
    lastVerifiedAt: null,
    outreachStatus: "none",
    status: "prospect",
    notes: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("Commercial intelligence — Laurens trace", () => {
  it("legt opportunityScore uit op basis van positief vacaturebewijs", () => {
    const hiringScore = 75;
    const assessment = computeOpportunityAssessment(laurensCompany(), plan, {
      hiringScore,
      desiredRoleMatch: true,
    });
    expect(assessment.opportunityScore).toBeGreaterThanOrEqual(70);
    expect(assessment.why.some((line) => /geverifieerde vacature|hiring-intelligence/i.test(line))).toBe(true);
  });

  it("leest employee range uit geverifieerd label zonder schatting", () => {
    const resolved = resolveCompanyEmployeeRangeBounds(laurensCompany());
    expect(resolved.min).toBe(250);
    expect(resolved.max).toBe(500);
    expect(evaluateEmployeeRangeConstraint(laurensCompany(), plan)).toBe("matched");
  });

  it("matcht recruitment-mailbox op hoofddomein laurens.nl", () => {
    expect(registrableDomain("werkenbij.laurens.nl")).toBe("laurens.nl");
    expect(contactEmailMatchesCompanyDomain("recruitment@laurens.nl", "werkenbij.laurens.nl")).toBe(true);
  });

  it("kwalificeert prospect voor draft-capable lifecycle met CRM-mailbox", () => {
    const vacancy = createVacancyEvidence({
      companyName: "Laurens",
      companyDomain: "werkenbij.laurens.nl",
      jobTitle: "Corporate Recruiter",
      jobUrl: LAURENS_VACANCY,
      sourceUrl: LAURENS_VACANCY,
      sourceType: "discovery_classification",
      desiredRoleMatch: true,
      validationReason: "discovery_classification: Concrete vacature gevonden tijdens discovery",
    });

    const eligibility = evaluateConceptEligibility({
      company: laurensCompany(),
      plan,
      hiringScore: 75,
      opportunityScore: computeOpportunityAssessment(laurensCompany(), plan, {
        hiringScore: 75,
        desiredRoleMatch: true,
      }).opportunityScore,
      vacancyCount: 1,
      vacancies: [vacancy],
      contact: null,
      contactStage: "blocked_missing_contact",
      desiredRoleMatch: true,
    });

    expect(strictVacancyEvidence(vacancy)).toBe(true);
    expect(eligibility.reasonCode).not.toBe("no_matching_role");
    expect(eligibility.contract?.commercial?.hiringPassed).toBe(true);
    expect(eligibility.contract?.commercial?.opportunityPassed).toBe(true);
    expect(eligibility.qualificationStatus).toBe("needs_evidence");
    expect(isProspectDraftCapable(eligibility, plan)).toBe(true);
    expect(deriveProspectLifecycle({
      eligibility,
      plan,
      contact: null,
    })).toBe("needs_enrichment");
  });
});