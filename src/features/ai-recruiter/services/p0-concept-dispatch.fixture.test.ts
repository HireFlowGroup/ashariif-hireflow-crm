/**
 * EXPLICIT_TEST_FIXTURE — concept dispatch + opslag met mocks (geen live API).
 */
import { describe, expect, it, vi } from "vitest";

import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { EligibleProspectForConcept } from "@/features/ai-recruiter/domain/concept-generation.types";
import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { dispatchConceptGeneration } from "@/features/ai-recruiter/services/concept-generation-dispatch.service";
import { createVacancyEvidence } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeSlotSupabaseClient(): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  } as unknown as SupabaseClient;
}

vi.mock("@/features/ai-recruiter/services/recruitment-outreach-writer.service", () => ({
  generateRecruitmentOutreachDraftWithValidation: vi.fn().mockResolvedValue({
    draft: {
      recommendedSubject: "Intro TechFlow (EXPLICIT_TEST_FIXTURE)",
      subject: "Intro TechFlow",
      salutation: "Beste recruitmentteam,",
      bodyText: "Ik zag uw Corporate Recruiter vacature in Rotterdam.",
      body: "Ik zag uw Corporate Recruiter vacature in Rotterdam.",
      cta: "Mag ik kandidaten voorstellen?",
      closing: "Met vriendelijke groet",
      personalizationFacts: [{ claim: "Corporate Recruiter vacature", sourceType: "vacancy", confidence: 0.9 }],
      sourceEvidence: [{ claim: "vacature URL", sourceType: "vacancy", confidence: 0.9 }],
      warnings: [],
      promptVersion: "fixture",
      model: "mock",
      confidence: 0.85,
    },
    meta: {
      provider: "mock",
      model: "mock",
      durationMs: 5,
      parsedSuccessfully: true,
      schemaValid: true,
      validationErrors: [],
      responseReceived: true,
      finishReason: "stop",
      rawResponseLength: 120,
    },
    usedFallback: false,
  }),
}));

const plan: AiRecruiterSearchPlan = {
  locations: ["Rotterdam"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiters"],
  vacancy_required: true,
  minimum_hiring_score: 70,
  minimum_opportunity_score: 70,
  maximum_companies: 3,
  maximum_drafts: 3,
  contact_roles: ["HR"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "EXPLICIT_TEST_FIXTURE",
};

function makeCompany(): Company {
  return {
    id: toCompanyId("co-fixture"),
    organizationId: "org-1",
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
    employeeCountLabel: "Bewijs in bron: 50-120",
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
        source: "careers_page",
        confidence: 0.9,
      },
    ],
    careersUrl: "https://techflow-fixture.nl/vacatures",
    vacancyPageUrl: "https://techflow-fixture.nl/vacatures/corporate-recruiter/",
    generalEmail: null,
    hrEmail: "hr@techflow-fixture.nl",
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
}

const eligibility: ConceptEligibilityResult = {
  eligible: true,
  qualificationStatus: "eligible",
  score: 82,
  threshold: 30,
  priority: "priority_a",
  acceptedRules: ["eligible_for_concept"],
  rejectedRules: [],
  reasonCode: "eligible",
  userMessage: "Eligible",
};

const vacancy = createVacancyEvidence({
  companyName: "TechFlow BV",
  companyDomain: "techflow-fixture.nl",
  jobTitle: "Corporate Recruiter",
  jobUrl: "https://techflow-fixture.nl/vacatures/corporate-recruiter/",
  sourceUrl: "https://techflow-fixture.nl/vacatures/corporate-recruiter/",
  sourceType: "careers_page_crawl",
  desiredRoleMatch: true,
  validationReason: "EXPLICIT_TEST_FIXTURE",
});

describe("P0 concept dispatch fixture", () => {
  it("creates and persists one personalized draft", async () => {
    const createRecruiterDraft = vi.fn().mockResolvedValue({
      id: "msg-fixture-1",
      status: "pending_review",
    });

    const prospect: EligibleProspectForConcept = {
      itemId: "item-fixture",
      companyId: toCompanyId("co-fixture"),
      company: makeCompany(),
      selected: {
        email: "hr@techflow-fixture.nl",
        recipientName: "HR Team",
        jobTitle: "HR",
        contactId: "contact-1",
        linkedinUrl: null,
        sourceType: "inferred",
        verificationStatus: "likely",
        relevanceScore: 80,
        confidence: 0.85,
        isGeneralMailbox: false,
        roleLabel: "HR",
        reliability: { level: "high", score: 85, summary: "", factors: [] },
        selectionReason: "fixture",
      } satisfies SelectedDiscoveredContact,
      vacancies: [vacancy],
      contactStage: "contact_found",
      opportunity: {
        opportunityScore: 72,
        agencyNeedLikelihood: "medium",
        recruitmentPotential: "MEDIUM",
        recruitmentPotentialMotivation: "",
        why: [],
        rolesSought: ["recruiters"],
        urgency: "medium",
        bestApproach: "",
        breakdown: {
          growth: 10,
          multipleVacancies: 10,
          noInternalRecruiter: 10,
          staleVacancies: 0,
          scalability: 10,
        },
      },
      eligibility,
    };

    const result = await dispatchConceptGeneration({
      context: { organizationId: "org-1", userId: "user-1" },
      runId: "run-fixture",
      plan,
      supabaseClient: makeSlotSupabaseClient(),
      eligibleProspects: [prospect],
      outreachEngine: { createRecruiterDraft } as never,
      repository: {
        getRunItem: vi.fn().mockResolvedValue({ externalCompanyData: {} }),
        updateRunItem: vi.fn().mockResolvedValue(undefined),
      } as never,
      prospectAudit: {
        updateConceptStatus: vi.fn().mockResolvedValue(undefined),
      } as never,
      maxConcepts: 3,
    });

    expect(result.counters.conceptsCreated).toBe(1);
    expect(createRecruiterDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subject: "Intro TechFlow (EXPLICIT_TEST_FIXTURE)",
        recipientEmail: "hr@techflow-fixture.nl",
      }),
    );
  });
});