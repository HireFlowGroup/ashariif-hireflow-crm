import { describe, expect, it } from "vitest";

import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { OutreachReadinessProspect } from "@/features/ai-recruiter/domain/outreach-readiness.types";
import { evaluateOutreachReadiness } from "@/features/ai-recruiter/services/evaluate-outreach-readiness.service";
import {
  countRecruitmentOutreachWords,
  generateRecruitmentOutreachDraft,
} from "@/features/ai-recruiter/services/recruitment-outreach-writer.service";
import { MAX_RECRUITMENT_OUTREACH_WORDS } from "@/features/ai-recruiter/domain/recruitment-outreach.types";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import { buildOutreachSalutation } from "@/features/contact-finder/services/contact-validation.service";
import { getOutreachSendConfig, validateSendEnabled, validateTestRecipient } from "@/features/outreach-engine/domain/send-rules.config";
import { buildFollowUpSchedule, cancelFollowUpsOnEvent } from "@/features/outreach-engine/services/follow-up-planner.service";
import type { Company } from "@/features/companies/domain";
import { toCompanyId } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";

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

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("co-1"),
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
    vacancyCount: 2,
    hiringSignals: [{ type: "vacancy", description: "Recruiter gezocht", source: "web", confidence: 0.8 }],
    careersUrl: "https://techflow.nl/werken-bij",
    vacancyPageUrl: null,
    generalEmail: null,
    hrEmail: "recruitment@techflow.nl",
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
    ...overrides,
  };
}

const vacancy: VacancyEvidence = {
  title: "Customer Success Manager",
  companyName: "TechFlow BV",
  location: "Rotterdam",
  sourceUrl: "https://techflow.nl/vacatures/csm",
  sourceDomain: "techflow.nl",
  publishedAt: null,
  validThrough: null,
  employmentType: null,
  department: null,
  hiringSignalStrength: 90,
  isActive: true,
  validationReason: "active",
  actuality: "known",
};

function baseProspect(overrides: Partial<OutreachReadinessProspect> = {}): OutreachReadinessProspect {
  return {
    companyId: "co-1",
    companyName: "TechFlow BV",
    isCompetitor: false,
    isGenericIdentity: false,
    score: 72,
    decision: "WARM",
    threshold: 50,
    eligible: true,
    contactEmail: "recruitment@techflow.nl",
    contactId: null,
    isGeneralMailbox: true,
    contactVerificationStatus: "likely",
    duplicateOutreach: false,
    cooldownActive: false,
    suppressedContact: false,
    bouncedContact: false,
    invalidContact: false,
    hasVacancyEvidence: true,
    vacancies: [vacancy],
    hiringSignalCount: 1,
    reasonCode: "eligible",
    userMessage: "ok",
    ...overrides,
  };
}

const opportunity: OpportunityAssessment = {
  opportunityScore: 70,
  agencyNeedLikelihood: "medium",
  recruitmentPotential: "MEDIUM",
  recruitmentPotentialMotivation: "",
  why: [],
  rolesSought: ["Customer Success Manager"],
  urgency: "medium",
  bestApproach: "",
  breakdown: { growth: 0, multipleVacancies: 0, noInternalRecruiter: 0, staleVacancies: 0, scalability: 0 },
};

describe("evaluateOutreachReadiness", () => {
  it("marks eligible prospect as ready", () => {
    const result = evaluateOutreachReadiness(baseProspect());
    expect(result.ready).toBe(true);
    expect(result.recipientType).toBe("recruitment_mailbox");
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("blocks duplicate outreach", () => {
    const result = evaluateOutreachReadiness(baseProspect({ duplicateOutreach: true }));
    expect(result.ready).toBe(false);
    expect(result.blockingReasons).toContain("duplicate_outreach");
  });

  it("blocks cooldown", () => {
    const result = evaluateOutreachReadiness(baseProspect({ cooldownActive: true }));
    expect(result.ready).toBe(false);
    expect(result.blockingReasons).toContain("cooldown_active");
  });

  it("blocks suppressed contact", () => {
    const result = evaluateOutreachReadiness(baseProspect({ suppressedContact: true }));
    expect(result.ready).toBe(false);
    expect(result.blockingReasons).toContain("suppressed_contact");
  });

  it("blocks bounced contact", () => {
    const result = evaluateOutreachReadiness(baseProspect({ bouncedContact: true }));
    expect(result.ready).toBe(false);
    expect(result.blockingReasons).toContain("bounced_contact");
  });

  it("does not block general mailbox when otherwise eligible", () => {
    const result = evaluateOutreachReadiness(baseProspect({ isGeneralMailbox: true }));
    expect(result.ready).toBe(true);
    expect(result.warnings).toContain("algemene_mailbox");
  });
});

describe("buildOutreachSalutation", () => {
  it("uses recruitment team salutation for recruitment@", () => {
    expect(buildOutreachSalutation(null, true, "recruitment@acme.nl")).toBe("Beste recruitmentteam,");
  });

  it("uses neutral salutation for info@", () => {
    expect(buildOutreachSalutation(null, true, "info@acme.nl")).toBe("Geachte heer/mevrouw,");
  });

  it("never uses invented first name for Contact placeholder", () => {
    expect(
      buildOutreachSalutation("Contact Team", false, "jan@acme.nl", { firstNameReliable: false }),
    ).not.toMatch(/Beste Contact,/);
  });

  it("uses first name when reliable", () => {
    expect(
      buildOutreachSalutation("Lisa Jansen", false, "lisa@acme.nl", { firstNameReliable: true }),
    ).toBe("Beste Lisa,");
  });
});

describe("generateRecruitmentOutreachDraft", () => {
  it("creates draft for eligible prospect with permission CTA", async () => {
    const company = makeCompany();
    const hiring = computeHiringIntelligenceProfile(company, plan);
    const draft = await generateRecruitmentOutreachDraft({
      company,
      hiringSignals: hiring,
      companyAnalysis: opportunity,
      selectedContact: {
        email: "recruitment@techflow.nl",
        recipientName: null,
        isGeneralMailbox: true,
      },
      opportunityScore: 70,
      vacancies: [vacancy],
    });

    expect(draft.bodyText.length).toBeGreaterThan(20);
    expect(draft.cta.toLowerCase()).toMatch(/kandidaten/);
    expect(draft.personalizationFacts.length).toBeGreaterThan(0);
  });

  it("creates usable draft for info mailbox", async () => {
    const company = makeCompany();
    const hiring = computeHiringIntelligenceProfile(company, plan);
    const draft = await generateRecruitmentOutreachDraft({
      company,
      hiringSignals: hiring,
      companyAnalysis: opportunity,
      selectedContact: {
        email: "info@techflow.nl",
        recipientName: null,
        isGeneralMailbox: true,
      },
      opportunityScore: 70,
      vacancies: [vacancy],
    });

    expect(draft.salutation).toBe("Geachte heer/mevrouw,");
    expect(draft.bodyText).toContain("Geachte heer/mevrouw");
  });

  it("keeps body under 130 words", async () => {
    const company = makeCompany();
    const hiring = computeHiringIntelligenceProfile(company, plan);
    const draft = await generateRecruitmentOutreachDraft({
      company,
      hiringSignals: hiring,
      companyAnalysis: opportunity,
      selectedContact: {
        email: "hr@techflow.nl",
        recipientName: "Jan de Vries",
        isGeneralMailbox: false,
        reliability: { level: "high", score: 80, summary: "", factors: [] },
      },
      opportunityScore: 70,
      vacancies: [vacancy],
    });

    expect(countRecruitmentOutreachWords(draft.bodyText)).toBeLessThanOrEqual(MAX_RECRUITMENT_OUTREACH_WORDS);
  });

  it("does not claim available candidates without evidence", async () => {
    const company = makeCompany();
    const hiring = computeHiringIntelligenceProfile(company, plan);
    const draft = await generateRecruitmentOutreachDraft({
      company,
      hiringSignals: hiring,
      companyAnalysis: opportunity,
      selectedContact: {
        email: "recruitment@techflow.nl",
        recipientName: null,
        isGeneralMailbox: true,
      },
      opportunityScore: 70,
      vacancies: [vacancy],
    });

    const lower = draft.bodyText.toLowerCase();
    expect(lower).not.toContain("wij hebben dé kandidaat");
    expect(lower).not.toContain("kandidaat beschikbaar");
  });

  it("links personalization facts to evidence", async () => {
    const company = makeCompany();
    const hiring = computeHiringIntelligenceProfile(company, plan);
    const draft = await generateRecruitmentOutreachDraft({
      company,
      hiringSignals: hiring,
      companyAnalysis: opportunity,
      selectedContact: {
        email: "recruitment@techflow.nl",
        recipientName: null,
        isGeneralMailbox: true,
      },
      opportunityScore: 70,
      vacancies: [vacancy],
    });

    for (const fact of draft.personalizationFacts) {
      expect(fact.claim.length).toBeGreaterThan(0);
      expect(fact.sourceType).toBeTruthy();
    }
  });
});

describe("send safety config", () => {
  it("send disabled by default", () => {
    expect(getOutreachSendConfig().sendEnabled).toBe(false);
    expect(validateSendEnabled(false)?.code).toBe("send_disabled");
  });

  it("test mode only allows configured recipient", () => {
    const prev = process.env.OUTREACH_TEST_RECIPIENT;
    process.env.OUTREACH_TEST_RECIPIENT = "test@hireflow.nl";
    expect(validateTestRecipient(true, "other@example.com")?.code).toBe("test_recipient_mismatch");
    expect(validateTestRecipient(true, "test@hireflow.nl")).toBeNull();
    process.env.OUTREACH_TEST_RECIPIENT = prev;
  });
});

describe("follow-up planner", () => {
  it("schedules follow-ups after send", () => {
    const items = buildFollowUpSchedule(new Date("2026-08-03T10:00:00Z"), "TechFlow hiring", "TechFlow BV");
    expect(items).toHaveLength(2);
    expect(items[0]?.sequenceNumber).toBe(1);
    expect(items[0]?.status).toBe("scheduled");
  });

  it("cancels follow-ups on reply", () => {
    const items = buildFollowUpSchedule(new Date("2026-08-03T10:00:00Z"), "Subject", "Co");
    const cancelled = cancelFollowUpsOnEvent(items, "reply_received");
    expect(cancelled.every((i) => i.status === "skipped_reply_received")).toBe(true);
  });
});
