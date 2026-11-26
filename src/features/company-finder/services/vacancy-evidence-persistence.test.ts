import { describe, expect, it } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import { buildDiscoveryCreateInput } from "@/features/company-finder/services/discovery-save";
import { applyDiscoveryVacancyEvidenceToCandidate } from "@/features/company-finder/services/discovery-vacancy-persistence";
import { createEmptyCandidate } from "@/features/lead-intelligence/providers/types";
import { mergeEnrichment } from "@/features/lead-intelligence/services/recruitment-normalize";
import { buildDiscoveryVacancyEvidenceFromCompany } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { normalizeUpdateCompanyInput } from "@/features/companies/services/normalize-company-input";
import { updateCompanyInputSchema } from "@/features/companies/validation/company.schemas";

const LAURENS_VACANCY = "https://werkenbij.laurens.nl/vacature/corporate-recruiter/";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const LAURENS_CANDIDATE_BASE = {
  source: "serpapi" as const,
  externalId: "laurens-discovery-1",
};

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
  reasoning: "targeted Laurens",
};

describe("vacancy evidence persistence (Laurens trace)", () => {
  it("bewaart concrete vacature-URL op discovery-kandidaat", () => {
    const base = createEmptyCandidate({
      ...LAURENS_CANDIDATE_BASE,
      name: "Laurens",
      website: "https://werkenbij.laurens.nl",
      domain: "werkenbij.laurens.nl",
      vacancyPageUrl: null,
      vacancyTitles: [],
      vacancyCount: 0,
    });

    const withEvidence = applyDiscoveryVacancyEvidenceToCandidate(
      base,
      {
        discoveryVacancyUrl: LAURENS_VACANCY,
        discoveryVacancyTitle: "Corporate Recruiter",
        discoveryVacancySource: "serpapi",
      },
      "serpapi",
    );

    expect(withEvidence.vacancyPageUrl).toBe(LAURENS_VACANCY);
    expect(withEvidence.vacancyTitles).toContain("Corporate Recruiter");
    expect(withEvidence.hiringSignals.some((s) => s.type === "active_vacancy")).toBe(true);
  });

  it("mapt discovery-kandidaat naar CRM create input met vacancy_page_url", () => {
    const candidate = createEmptyCandidate({
      ...LAURENS_CANDIDATE_BASE,
      name: "Laurens",
      website: "https://werkenbij.laurens.nl",
      domain: "werkenbij.laurens.nl",
      vacancyPageUrl: LAURENS_VACANCY,
      vacancyTitles: ["Corporate Recruiter"],
      vacancyCount: 1,
      hiringSignals: [
        {
          type: "active_vacancy",
          description: "Corporate Recruiter",
          source: "serpapi",
          confidence: 0.85,
        },
      ],
    });

    const input = buildDiscoveryCreateInput(candidate, USER_ID, "serpapi");
    expect(input.vacancyPageUrl).toBe(LAURENS_VACANCY);
    expect(input.hiringSignals?.length).toBeGreaterThan(0);
  });

  it("ver0wast achtergrond-enrichment geen concrete discovery-URL", () => {
    const discovery = createEmptyCandidate({
      ...LAURENS_CANDIDATE_BASE,
      name: "Laurens",
      vacancyPageUrl: LAURENS_VACANCY,
      vacancyTitles: ["Corporate Recruiter"],
    });
    const merged = mergeEnrichment(discovery, {
      vacancyPageUrl: "https://werkenbij.laurens.nl/werken-bij",
      careersUrl: "https://werkenbij.laurens.nl/werken-bij",
    });
    expect(merged.vacancyPageUrl).toBe(LAURENS_VACANCY);
  });

  it("bouwt discovery-classification evidence na CRM read-back", () => {
    const company: Company = {
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
      city: "Nederland",
      region: null,
      province: null,
      country: "NL",
      employeeCount: null,
      employeeCountMin: null,
      employeeCountMax: null,
      employeeCountLabel: null,
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
          confidence: 0.85,
        },
      ],
      careersUrl: null,
      vacancyPageUrl: LAURENS_VACANCY,
      generalEmail: null,
      hrEmail: null,
      kvkNumber: null,
      aiSummary: null,
      source: "serpapi",
      sourceUrl: "https://werkenbij.laurens.nl",
      confidence: 0.8,
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
    };

    const evidence = buildDiscoveryVacancyEvidenceFromCompany(company, plan);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.jobUrl).toBe(LAURENS_VACANCY);
    expect(evidence[0]?.desiredRoleMatch).toBe(true);
  });

  it("laat updateCompany vacancy-evidence door validatie", () => {
    const normalized = normalizeUpdateCompanyInput({
      vacancyPageUrl: LAURENS_VACANCY,
      vacancyCount: 1,
      hiringSignals: [
        {
          type: "active_vacancy",
          description: "Corporate Recruiter",
          source: "serpapi",
          confidence: 0.85,
        },
      ],
    });
    const parsed = updateCompanyInputSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.vacancyPageUrl).toBe(LAURENS_VACANCY);
  });
});