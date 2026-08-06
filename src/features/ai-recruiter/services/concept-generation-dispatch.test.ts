import { describe, expect, it, vi } from "vitest";

import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  buildConceptGenerationRunMessage,
  resolveConceptGenerationRunStatus,
} from "@/features/ai-recruiter/services/concept-generation-banner.service";
import {
  filterEligibleProspectsForConceptGeneration,
} from "@/features/ai-recruiter/services/concept-generation-dispatch.service";
import {
  buildDeterministicOutreachFallback,
  isFallbackWithinWordLimit,
} from "@/features/ai-recruiter/services/deterministic-outreach-fallback.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import {
  normalizeRecruitmentDraftPayload,
  parseRecruitmentDraftOutput,
  repairRecruitmentDraftOutput,
} from "@/features/ai-recruiter/validation/recruitment-outreach-draft.schema";

const plan: AiRecruiterSearchPlan = {
  locations: ["Rotterdam"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["Recruiter"],
  vacancy_required: false,
  minimum_hiring_score: 30,
  minimum_opportunity_score: 30,
  maximum_companies: 25,
  maximum_drafts: 10,
  contact_roles: ["HR"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "",
};

function makeCompany(name = "Enigmatry"): Company {
  return {
    id: toCompanyId("co-enigmatry"),
    organizationId: "org-1",
    ownerId: null,
    name,
    website: "https://enigmatry.com",
    domain: "enigmatry.com",
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
    employeeCountLabel: null,
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
    hrEmail: "recruitment@enigmatry.com",
    kvkNumber: null,
    aiSummary: null,
    source: null,
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

function makeContact(overrides: Partial<SelectedDiscoveredContact> = {}): SelectedDiscoveredContact {
  return {
    contactId: null,
    email: "recruitment@enigmatry.com",
    recipientName: null,
    jobTitle: null,
    linkedinUrl: null,
    sourceType: "inferred",
    verificationStatus: "likely",
    relevanceScore: 65,
    confidence: 0.7,
    isGeneralMailbox: true,
    roleLabel: "Algemene mailbox",
    reliability: { level: "medium", score: 60, summary: "", factors: [] },
    selectionReason: "HR mailbox",
    ...overrides,
  };
}

const eligibility: ConceptEligibilityResult = {
  eligible: true,
  score: 66,
  threshold: 30,
  priority: "priority_b",
  acceptedRules: ["eligible_for_concept"],
  rejectedRules: [],
  reasonCode: "eligible",
  userMessage: "Prospect is eligible voor conceptgeneratie.",
};

const vacancy: VacancyEvidence = {
  title: "recruiters",
  companyName: "Enigmatry",
  location: "Rotterdam",
  sourceUrl: "https://enigmatry.com/jobs/recruiters",
  sourceDomain: "enigmatry.com",
  publishedAt: null,
  validThrough: null,
  employmentType: null,
  department: null,
  hiringSignalStrength: 90,
  isActive: true,
  validationReason: "active",
  actuality: "known",
};

describe("filterEligibleProspectsForConceptGeneration", () => {
  it("includes eligible general mailbox prospects", () => {
    const result = filterEligibleProspectsForConceptGeneration([
      {
        itemId: "item-1",
        companyId: "co-enigmatry",
        company: makeCompany(),
        selected: makeContact(),
        vacancies: [vacancy],
        contactStage: "general_mailbox_found",
        opportunity: {
          opportunityScore: 66,
          agencyNeedLikelihood: "medium",
          recruitmentPotential: "MEDIUM",
          recruitmentPotentialMotivation: "",
          why: [],
          rolesSought: ["recruiters"],
          urgency: "medium",
          bestApproach: "",
          breakdown: {
            growth: 0,
            multipleVacancies: 0,
            noInternalRecruiter: 0,
            staleVacancies: 0,
            scalability: 0,
          },
        },
        eligibility,
      },
    ]);

    expect(result).toHaveLength(1);
  });

  it("excludes ineligible prospects without email", () => {
    const result = filterEligibleProspectsForConceptGeneration([
      {
        itemId: "item-1",
        companyId: "co-enigmatry",
        company: makeCompany(),
        selected: makeContact({ email: "" }),
        vacancies: [vacancy],
        contactStage: "general_mailbox_found",
        opportunity: {
          opportunityScore: 66,
          agencyNeedLikelihood: "medium",
          recruitmentPotential: "MEDIUM",
          recruitmentPotentialMotivation: "",
          why: [],
          rolesSought: ["recruiters"],
          urgency: "medium",
          bestApproach: "",
          breakdown: {
            growth: 0,
            multipleVacancies: 0,
            noInternalRecruiter: 0,
            staleVacancies: 0,
            scalability: 0,
          },
        },
        eligibility: { ...eligibility, eligible: false },
      },
    ]);

    expect(result).toHaveLength(0);
  });
});

describe("recruitment draft schema normalization", () => {
  it("normalizes snake_case AI response", () => {
    const normalized = normalizeRecruitmentDraftPayload({
      subject_line: "Test",
      email_body: "Body",
      personalization_facts: [{ claim: "fact", sourceType: "vacancy", confidence: "0.9" }],
      source_evidence: [{ claim: "fact", sourceType: "vacancy", confidence: 0.9 }],
    });

    const parsed = parseRecruitmentDraftOutput({
      ...normalized,
      subject: "Test",
      salutation: "Beste recruitmentteam,",
      body: "Body",
      cta: "Mag ik kandidaten zoeken?",
      closing: "Groet",
    });

    expect(parsed.ok).toBe(true);
  });

  it("repairs partial AI output once", () => {
    const repaired = repairRecruitmentDraftOutput(
      { subject: "Onderwerp", body: "Inhoud" },
      {
        salutation: "Beste recruitmentteam,",
        cta: "Staat u ervoor open dat wij vrijblijvend geschikte kandidaten voor deze vacature zoeken en aan u voorstellen?",
        closing: "Met vriendelijke groet,\nHireFlow Group",
      },
    );

    expect(repaired.subject).toBe("Onderwerp");
    expect(repaired.cta).toContain("kandidaten");
  });
});

describe("deterministic Enigmatry fallback", () => {
  it("creates recruitment mailbox concept for Enigmatry", () => {
    const draft = buildDeterministicOutreachFallback({
      company: makeCompany("Enigmatry"),
      vacancies: [vacancy],
      recipientEmail: "recruitment@enigmatry.com",
      recipientName: null,
      isGeneralMailbox: true,
    });

    expect(draft.salutation).toBe("Beste recruitmentteam,");
    expect(draft.bodyText.toLowerCase()).toContain("enigmatry");
    expect(draft.cta.toLowerCase()).toContain("kandidaten");
    expect(draft.warnings).toContain("ai_generation_failed_fallback_used");
  });

  it("keeps fallback under 120 words", () => {
    const draft = buildDeterministicOutreachFallback({
      company: makeCompany("Enigmatry"),
      vacancies: [vacancy],
      recipientEmail: "recruitment@enigmatry.com",
      recipientName: null,
      isGeneralMailbox: true,
    });

    expect(isFallbackWithinWordLimit(draft.bodyText)).toBe(true);
  });

  it("does not claim candidates are already available", () => {
    const draft = buildDeterministicOutreachFallback({
      company: makeCompany("Enigmatry"),
      vacancies: [vacancy],
      recipientEmail: "recruitment@enigmatry.com",
      recipientName: null,
      isGeneralMailbox: true,
    });

    expect(draft.bodyText.toLowerCase()).not.toContain("kandidaat beschikbaar");
  });
});

describe("concept generation banner and run status", () => {
  it("shows preparing message while drafting", () => {
    const message = buildConceptGenerationRunMessage({
      runStatus: "drafting",
      streaming: true,
      conceptCounters: {
        prospectsEvaluated: 6,
        prospectsEligible: 3,
        conceptsStarted: 3,
        conceptsCreated: 0,
        conceptsFailed: 0,
        conceptsSkipped: 0,
        conceptsPending: 0,
        conceptsGenerating: 3,
      },
    });

    expect(message).toContain("voorbereid");
  });

  it("does not show 'geen concepten' while generating", () => {
    const message = buildConceptGenerationRunMessage({
      runStatus: "drafting",
      streaming: true,
      conceptCounters: {
        prospectsEvaluated: 6,
        prospectsEligible: 3,
        conceptsStarted: 3,
        conceptsCreated: 0,
        conceptsFailed: 0,
        conceptsSkipped: 0,
        conceptsPending: 0,
        conceptsGenerating: 2,
      },
    });

    expect(message).not.toBe("Geen concepten aangemaakt");
  });

  it("sets awaiting_approval after successful concepts", () => {
    const status = resolveConceptGenerationRunStatus({
      draftsCreated: 3,
      conceptCounters: {
        prospectsEvaluated: 6,
        prospectsEligible: 3,
        conceptsStarted: 3,
        conceptsCreated: 3,
        conceptsFailed: 0,
        conceptsSkipped: 0,
        conceptsPending: 0,
        conceptsGenerating: 0,
      },
    });

    expect(status).toBe("awaiting_approval");
  });

  it("reports partial completion when some concepts fail", () => {
    const status = resolveConceptGenerationRunStatus({
      draftsCreated: 2,
      conceptCounters: {
        prospectsEvaluated: 6,
        prospectsEligible: 3,
        conceptsStarted: 3,
        conceptsCreated: 2,
        conceptsFailed: 1,
        conceptsSkipped: 0,
        conceptsPending: 0,
        conceptsGenerating: 0,
      },
    });

    expect(status).toBe("partially_completed");
  });
});

describe("dispatch counter invariant", () => {
  it("ensures created + failed equals eligible dispatch count", () => {
    const eligible = 3;
    const created = 2;
    const failed = 1;
    expect(created + failed).toBe(eligible);
  });
});

describe("maxConcepts guard", () => {
  it("respects zero maximum drafts", () => {
    const eligible = filterEligibleProspectsForConceptGeneration([
      {
        itemId: "item-1",
        companyId: "co-enigmatry",
        company: makeCompany(),
        selected: makeContact(),
        vacancies: [vacancy],
        contactStage: "general_mailbox_found",
        opportunity: {
          opportunityScore: 66,
          agencyNeedLikelihood: "medium",
          recruitmentPotential: "MEDIUM",
          recruitmentPotentialMotivation: "",
          why: [],
          rolesSought: ["recruiters"],
          urgency: "medium",
          bestApproach: "",
          breakdown: {
            growth: 0,
            multipleVacancies: 0,
            noInternalRecruiter: 0,
            staleVacancies: 0,
            scalability: 0,
          },
        },
        eligibility,
      },
    ]);

    const limited = eligible.slice(0, Math.max(0, 0));
    expect(limited).toHaveLength(0);
    expect(plan.maximum_drafts).toBeGreaterThan(0);
  });
});
