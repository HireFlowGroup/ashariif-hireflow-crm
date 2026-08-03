import { describe, expect, it } from "vitest";

import type { OutreachIntelligenceContext } from "@/features/outreach-intelligence/domain/types";
import { ensureSignalReferences } from "@/features/outreach-generator/domain/generator.schema";
import { buildFallbackOutreachContent } from "@/features/outreach-generator/services/fallback-outreach-generator";

const mockContext: OutreachIntelligenceContext = {
  organizationId: "org-1",
  userId: "user-1",
  companyId: "company-1",
  companyName: "Acme BV",
  sector: "Tech",
  city: "Amsterdam",
  website: "https://acme.nl",
  linkedinUrl: null,
  email: null,
  phone: null,
  leadScore: 72,
  leadPriority: "high",
  hiringIntensity: 65,
  signalCount: 2,
  lastSignalAt: "2026-08-01T10:00:00Z",
  aiSummary: "Acme groeit snel in engineering.",
  vacancyCount: 3,
  contacts: [
    {
      id: "contact-1",
      firstName: "Jan",
      lastName: "Jansen",
      email: "jan@acme.nl",
      phone: null,
      jobTitle: "HR Manager",
      linkedinUrl: null,
      confidence: 0.9,
    },
  ],
  signals: [
    {
      id: "signal-1",
      signalType: "vacancy",
      title: "3 nieuwe engineering vacatures",
      description: "Meerdere backend rollen gepubliceerd",
      observedAt: "2026-08-01T10:00:00Z",
      importance: 8,
    },
    {
      id: "signal-2",
      signalType: "ats_detected",
      title: "Greenhouse ATS gedetecteerd",
      description: null,
      observedAt: "2026-07-28T08:00:00Z",
      importance: 5,
    },
  ],
  vacancies: [
    { id: "vac-1", title: "Senior Backend Engineer", createdAt: "2026-08-01T09:00:00Z" },
  ],
};

describe("buildFallbackOutreachContent", () => {
  it("references hiring signals in every asset", () => {
    const content = ensureSignalReferences(
      buildFallbackOutreachContent(mockContext, "Jan Jansen", "consultative"),
      ["Vacancy spike: 3 nieuwe engineering vacatures"],
    );

    expect(content.coldEmail.referencedSignals.length).toBeGreaterThan(0);
    expect(content.linkedinMessage.referencedSignals.length).toBeGreaterThan(0);
    expect(content.callScript.referencedSignals.length).toBeGreaterThan(0);
    expect(content.voicemail.referencedSignals.length).toBeGreaterThan(0);
    expect(content.followUp1.referencedSignals.length).toBeGreaterThan(0);
    expect(content.followUp2.referencedSignals.length).toBeGreaterThan(0);
    expect(content.followUp3.referencedSignals.length).toBeGreaterThan(0);

    expect(content.coldEmail.body).toContain("Acme BV");
    expect(content.coldEmail.body.toLowerCase()).not.toContain("marktleider");
  });

  it("adapts greeting for formal style", () => {
    const content = buildFallbackOutreachContent(mockContext, "Jan Jansen", "formal");
    expect(content.coldEmail.body).toContain("Geachte Jan");
  });
});
