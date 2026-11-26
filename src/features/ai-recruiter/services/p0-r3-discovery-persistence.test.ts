import { describe, expect, it, vi } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import {
  assertSafeWebsiteUrl,
  safeFetchWebsiteText,
} from "@/features/company-finder/discovery/safe-website-fetch.service";
import {
  buildCanonicalCompanyIdentity,
  canonicalCandidateDedupeKey,
} from "@/features/company-finder/discovery/canonical-company-identity.service";
import {
  classifyBusinessModel,
  isExcludedBusinessModel,
} from "@/features/company-finder/discovery/business-model-classifier.service";
import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import { applyDiscoveryPlanConstraints } from "@/features/ai-recruiter/services/discovery-query-builder.service";
import { assessVacancyEvidence } from "@/features/ai-recruiter/services/company-vacancy-validation.service";
import {
  buildProspectEvidenceQueue,
  isCommerciallyPresentableProspect,
} from "@/features/ai-recruiter/services/prospect-evidence-queue.service";
import { buildPipelineFunnelDiagnostics } from "@/features/ai-recruiter/services/pipeline-funnel-diagnostics.service";
import { createInitialCounters } from "@/features/ai-recruiter/domain/types";
import { dedupeCandidates, matchAgainstExisting } from "@/features/lead-intelligence/services/dedupe";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { limitQualifiedDiscoveryCandidatesForPersistence } from "@/features/ai-recruiter/services/search-plan-limits.service";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import { emptyDiscoverySummary } from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";
import { evaluateDiscoveryPlanConstraints } from "@/features/company-finder/discovery/discovery-plan-constraint.service";
import { createEmptyCandidate } from "@/features/lead-intelligence/providers/types";
import { baseTestCandidate } from "@/features/lead-intelligence/services/test-fixtures";

vi.mock("@/features/company-finder/discovery/safe-website-fetch.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/company-finder/discovery/safe-website-fetch.service")>();
  return {
    ...actual,
    safeFetchWebsiteText: vi.fn(actual.safeFetchWebsiteText),
    safeReadWebsiteTextOrNull: vi.fn(actual.safeReadWebsiteTextOrNull),
  };
});

const plan: AiRecruiterSearchPlan = {
  locations: ["Rotterdam"],
  regions: [],
  sectors: ["software"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiter"],
  vacancy_required: true,
  minimum_hiring_score: 70,
  minimum_opportunity_score: 70,
  maximum_companies: 2,
  maximum_drafts: 1,
  contact_roles: ["HR Manager"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: ["ConcurrentX"],
  uncertainties: [],
  reasoning: "",
};

function baseCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId("c-1"),
    organizationId: "org-tenant-a",
    ownerId: null,
    name: "Employer BV",
    website: "https://employer.nl",
    domain: "employer.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "software",
    city: "Rotterdam",
    region: "ZH",
    province: null,
    country: "NL",
    employeeCount: 80,
    employeeCountMin: null,
    employeeCountMax: null,
    employeeCountLabel: null,
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
    sourceUrl: "https://employer.nl",
    confidence: null,
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

function candidate(
  partial: Partial<ExternalCompanyCandidate> & Pick<ExternalCompanyCandidate, "name">,
): ExternalCompanyCandidate {
  return {
    ...baseTestCandidate,
    ...partial,
    normalizedName: partial.normalizedName ?? partial.name.toLowerCase(),
    externalId: partial.externalId ?? `${partial.name}-id`,
    source: partial.source ?? "test",
  };
}

describe("P0-R3 discovery, dedupe & persistence", () => {
  it("blocks unsafe website URLs (SSRF)", async () => {
    expect(assertSafeWebsiteUrl("http://127.0.0.1/admin").ok).toBe(false);
    expect(assertSafeWebsiteUrl("http://169.254.169.254/latest").ok).toBe(false);
    const blocked = await safeFetchWebsiteText("http://localhost/secret");
    expect(blocked.ok).toBe(false);
  });

  it("classifies recruitment agency vs employer", () => {
    const agency = classifyBusinessModel({
      name: "Uitzendbureau Top Staffing",
      url: "https://topstaffing.nl",
      description: "Detachering en personeelsbemiddeling",
      sector: "HR",
      excludeRecruitmentAgencies: true,
    });
    expect(isExcludedBusinessModel(agency.classification, true)).toBe(true);

    const employer = classifyBusinessModel({
      name: "SaaS Works BV",
      url: "https://saasworks.nl",
      description: "B2B software product",
      sector: "software",
      excludeRecruitmentAgencies: true,
    });
    expect(isExcludedBusinessModel(employer.classification, true)).toBe(false);
  });

  it("rejects wrong sector/location via discovery plan constraints", () => {
    const metaal = candidate({
      name: "Metaal Fabriek",
      city: "Eindhoven",
      sector: "manufacturing",
    });
    const criteria: CompanySearchCriteria = {
      sector: "software",
      sectors: ["software"],
      locations: ["Rotterdam"],
      city: "Rotterdam",
      desiredRoles: ["recruiter"],
    };
    const result = evaluateDiscoveryPlanConstraints({
      candidate: metaal,
      criteria,
      result: {
        title: "Metaal Fabriek",
        url: "https://metaal.nl",
        description: "Industrial manufacturing in Eindhoven",
        discoveryLocation: "Eindhoven",
      },
    });
    expect(result.acceptable).toBe(false);
  });

  it("does not treat vacancy hint as confirmed vacancy", () => {
    const company = baseCompany({
      vacancyPageUrl: "https://employer.nl/werken-bij",
      hiringSignals: [
        { type: "vacancy", description: "vacatures", source: "discovery", confidence: 0.4 },
      ],
    });
    const assessed = assessVacancyEvidence({
      company,
      plan,
      parsedVacancies: [],
      preservedDiscoveryEvidence: [],
      evidenceSource: "careers_page_crawl",
    });
    expect(assessed.status).not.toBe("accepted");
    expect(assessed.confirmedVacancyCount).toBe(0);
    expect(["needs_investigation", "insufficient_evidence"]).toContain(assessed.status);
  });

  it("dedupes companies within one run by canonical domain", () => {
    const a = candidate({
      name: "Alpha BV",
      website: "https://alpha.nl",
      domain: "alpha.nl",
      city: "Rotterdam",
      confidence: 0.7,
    });
    const b = candidate({
      name: "Alpha Holding",
      website: "https://www.alpha.nl",
      domain: "alpha.nl",
      city: "Rotterdam",
      confidence: 0.9,
    });
    const unique = dedupeCandidates([a, b]);
    expect(unique).toHaveLength(1);
    expect(unique[0]?.confidence).toBe(0.9);
  });

  it("does not merge companies on fuzzy name without shared domain", () => {
    const existing = baseCompany({
      id: toCompanyId("existing"),
      name: "Brightworks",
      website: "https://brightworks-a.nl",
      domain: "brightworks-a.nl",
    });
    const incoming = candidate({
      name: "Brightworks International",
      website: "https://brightworks-b.nl",
      domain: "brightworks-b.nl",
      confidence: 0.8,
    });
    const match = matchAgainstExisting(incoming, [existing]);
    expect(match.isDuplicate).toBe(false);
  });

  it("scopes canonical dedupe keys per tenant", () => {
    const sameSite = buildCanonicalCompanyIdentity({
      organizationId: "org-a",
      name: "Test",
      website: "https://test.nl",
    });
    const otherTenant = buildCanonicalCompanyIdentity({
      organizationId: "org-b",
      name: "Test",
      website: "https://test.nl",
    });
    expect(sameSite.dedupeKey).not.toEqual(otherTenant.dedupeKey);
    expect(canonicalCandidateDedupeKey({ name: "Test", website: "https://test.nl" })).toContain("domain::test.nl");
  });

  it("enforces maximum_companies server-side with deterministic deferral", () => {
    const qualified: QualifiedDiscoveryCandidate[] = [1, 2, 3].map((i) => ({
      candidate: candidate({ name: `Co ${i}`, website: `https://c${i}.nl`, domain: `c${i}.nl` }),
      confidence: i / 10,
      companyType: "company_website",
      companyConfidence: 0.8,
      discoveryReason: "test",
      discoveryProvider: "test",
      homepageSignals: [],
      acceptedSignals: [],
      urlCategory: "company",
      homepageSignalCount: 1,
      saveStatus: "company",
    }));

    const { toPersist, deferredCount } = limitQualifiedDiscoveryCandidatesForPersistence(qualified, 2);
    expect(toPersist).toHaveLength(2);
    expect(deferredCount).toBe(1);
  });

  it("builds evidence queue for needs_evidence prospects and blocks commercial presentation", () => {
    const item: AiRecruiterRunItem = {
      id: "item-1",
      organizationId: "org-1",
      runId: "run-1",
      companyId: "company-1",
      externalCompanyData: {
        eligibility: {
          eligible: false,
          qualificationStatus: "needs_evidence",
          score: 42,
          threshold: 30,
          priority: "hold",
          acceptedRules: [],
          rejectedRules: ["employee_range"],
          reasonCode: "employee_range_unknown",
          userMessage: "Medewerkersaantal onbekend",
        },
        boundedEnrichment: {
          budget: {
            maxSteps: 4,
            maxProviderCalls: 1,
            stepsUsed: 4,
            providerCallsUsed: 1,
            budgetExhausted: true,
            stopReason: "provider-budget uitgeput",
          },
          steps: [{ step: "read_company_website", success: false, providerCall: false, message: "geen tekst", evidenceAdded: [] }],
          evidence: { version: "p0-r2-v1", records: [], missingCriteria: ["employee_range"], conflictingCriteria: [] },
          companyUpdates: {
            employeeCountMin: null,
            employeeCountMax: null,
            employeeCountLabel: null,
            sector: null,
            city: null,
            region: null,
          },
          enrichmentSucceeded: false,
          enrichmentIncompleteReason: "budget",
        },
      },
      stage: "scored",
      status: "completed",
      discoveryScore: null,
      hiringScore: null,
      contactScore: null,
      outreachScore: null,
      totalScore: null,
      scoreBreakdown: {
        companyFit: 0,
        hiring: 0,
        opportunity: 0,
        contact: 0,
        personalization: 0,
        outreachReadiness: 0,
        explanations: [],
        opportunityWhy: [],
        rolesSought: [],
        salesWhy: [],
      },
      rejectionReason: null,
      warnings: [],
      selectedContactId: null,
      outreachMessageId: null,
      createdAt: "",
      updatedAt: "",
      companyName: "Unknown Headcount BV",
    };

    const queue = buildProspectEvidenceQueue([item]);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.conceptBlocked).toBe(true);
    expect(isCommerciallyPresentableProspect(item.externalCompanyData.eligibility as never)).toBe(false);
  });

  it("aligns pipeline funnel diagnostics counters", () => {
    const funnel = buildPipelineFunnelDiagnostics({
      discoverySummary: { ...emptyDiscoverySummary(), responseCount: 40, providerName: "tavily" },
      counters: { ...createInitialCounters(), found: 10, validated: 3, skipped: 7 },
      eligibilityDecisions: [
        {
          eligible: true,
          qualificationStatus: "eligible",
          score: 80,
          threshold: 30,
          priority: "priority_a",
          acceptedRules: [],
          rejectedRules: [],
          reasonCode: "eligible",
          userMessage: "",
        },
        {
          eligible: false,
          qualificationStatus: "needs_evidence",
          score: 40,
          threshold: 30,
          priority: "low_priority",
          acceptedRules: [],
          rejectedRules: [],
          reasonCode: "needs_evidence",
          userMessage: "",
        },
        {
          eligible: false,
          qualificationStatus: "rejected",
          score: 10,
          threshold: 30,
          priority: "reject",
          acceptedRules: [],
          rejectedRules: [],
          reasonCode: "no_matching_role",
          userMessage: "",
        },
      ],
      enrichmentAttempts: 3,
      conceptsCreated: 0,
    });
    expect(funnel.searchResultsReceived).toBe(40);
    expect(funnel.eligibleProspects).toBe(1);
    expect(funnel.needsEvidenceProspects).toBe(1);
    expect(funnel.rejectedProspects).toBe(1);
    expect(funnel.providerUsed).toBe("tavily");
  });

  it("appends plan exclusions to discovery queries", () => {
    const withExclusions = applyDiscoveryPlanConstraints("recruiter vacature Rotterdam", plan);
    expect(withExclusions).toContain('-"ConcurrentX"');
    expect(withExclusions).toContain("-uitzendbureau");
  });
});