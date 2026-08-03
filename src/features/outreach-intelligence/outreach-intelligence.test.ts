import { describe, expect, it } from "vitest";

import {
  computeOutreachScore,
} from "@/features/outreach-intelligence/services/outreach-scoring.service";
import {
  rankContacts,
  scoreChannels,
} from "@/features/outreach-intelligence/services/outreach-heuristics.service";
import type { OutreachIntelligenceContext } from "@/features/outreach-intelligence/domain/types";

const baseContext: OutreachIntelligenceContext = {
  organizationId: "org-1",
  userId: "user-1",
  companyId: "company-1",
  companyName: "Acme BV",
  sector: "Software",
  city: "Amsterdam",
  website: "https://acme.nl",
  linkedinUrl: null,
  email: "info@acme.nl",
  phone: null,
  leadScore: 82,
  leadPriority: "A",
  hiringIntensity: 75,
  signalCount: 5,
  lastSignalAt: new Date().toISOString(),
  aiSummary: "Growing tech company",
  vacancyCount: 2,
  contacts: [
    {
      id: "c1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.nl",
      phone: null,
      jobTitle: "HR Manager",
      linkedinUrl: "https://linkedin.com/in/jane",
      confidence: 0.9,
    },
  ],
  signals: [],
  vacancies: [],
};

describe("outreach heuristics", () => {
  it("ranks HR contact highest", () => {
    const ranked = rankContacts(baseContext);
    expect(ranked[0]?.name).toBe("Jane Doe");
    expect(ranked[0]?.score).toBeGreaterThan(50);
  });

  it("prefers email when contact has email", () => {
    const ranked = rankContacts(baseContext);
    const channel = scoreChannels(baseContext, ranked[0] ?? null);
    expect(channel.recommended).toBe("email");
    expect(channel.scores.email).toBeGreaterThan(0);
  });
});

describe("outreach scoring", () => {
  it("computes outreach score and response probability", () => {
    const ranked = rankContacts(baseContext);
    const channel = scoreChannels(baseContext, ranked[0] ?? null);
    const result = computeOutreachScore(baseContext, ranked[0] ?? null, channel.scores);
    expect(result.score).toBeGreaterThan(40);
    expect(result.responseProbability).toBeGreaterThan(20);
    expect(result.responseProbability).toBeLessThanOrEqual(92);
  });
});
