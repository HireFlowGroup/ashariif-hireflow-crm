import { describe, expect, it } from "vitest";

import type { CompanyAnalysisContext } from "@/features/company-ai-analysis/domain/analysis.types";
import { buildFallbackAnalysis } from "@/features/company-ai-analysis/services/company-analysis-generator.service";

function baseContext(overrides: Partial<CompanyAnalysisContext> = {}): CompanyAnalysisContext {
  return {
    organizationId: "org-1",
    companyId: "company-1",
    companyName: "Acme BV",
    sector: "IT",
    city: "Amsterdam",
    region: "Noord-Holland",
    website: "https://acme.nl",
    domain: "acme.nl",
    linkedinUrl: null,
    careersUrl: null,
    vacancyPageUrl: null,
    leadScore: 72,
    leadPriority: "B",
    scoreReason: "Actieve hiring signalen",
    hiringIntensity: 65,
    signalCount: 2,
    lastSignalAt: "2026-08-03T10:00:00.000Z",
    atsProviders: ["Greenhouse"],
    atsDetected: true,
    signals: [
      {
        id: "signal-1",
        type: "vacancy",
        typeLabel: "Vacature",
        title: "Senior Developer",
        description: "Backend vacature",
        source: "Indeed",
        sourceUrl: null,
        confidence: 0.8,
        importance: 85,
        aiRelevance: 70,
        observedAt: "2026-08-03T10:00:00.000Z",
        provider: "indeed",
      },
    ],
    vacancies: [
      {
        id: "vac-1",
        title: "Senior Developer",
        status: "open",
        location: "Amsterdam",
        source: "Indeed",
      },
    ],
    contacts: [
      {
        id: "contact-1",
        name: "Jane Doe",
        jobTitle: "HR Manager",
        email: "jane@acme.nl",
        phone: null,
        linkedinUrl: null,
        confidence: 0.9,
      },
    ],
    similarCompanies: [
      {
        id: "company-2",
        name: "Beta BV",
        sector: "IT",
        city: "Amsterdam",
        score: 70,
        hiringIntensity: 60,
        similarityReasons: ["Zelfde sector: IT"],
      },
    ],
    outreachRecommendedContact: null,
    outreachRecommendedRole: null,
    outreachAngle: null,
    dataFingerprint: "fp-1",
    ...overrides,
  };
}

describe("buildFallbackAnalysis", () => {
  it("uses only HireFlow context fields", () => {
    const sections = buildFallbackAnalysis(baseContext());

    expect(sections.summary).toContain("Acme BV");
    expect(sections.suitableRoles).toContain("Senior Developer");
    expect(sections.likelyAts).toContain("Greenhouse");
    expect(sections.competitors).toContain("Beta BV");
    expect(sections.likelyDecisionMaker).toContain("Jane Doe");
    expect(sections.topHiringSignal).toContain("Senior Developer");
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(sections.recruitmentPotential);
    expect(sections.recruitmentPotentialMotivation.length).toBeGreaterThan(10);
  });

  it("returns unavailable message when data is missing", () => {
    const sections = buildFallbackAnalysis(
      baseContext({
        signals: [],
        vacancies: [],
        contacts: [],
        similarCompanies: [],
        atsProviders: [],
        atsDetected: false,
      }),
    );

    expect(sections.topHiringSignal).toContain("Geen data beschikbaar in HireFlow");
    expect(sections.competitors).toContain("Geen data beschikbaar in HireFlow");
  });
});
