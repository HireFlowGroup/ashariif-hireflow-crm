import { describe, expect, it } from "vitest";

import { buildDiscoveryCreateInput } from "@/features/company-finder/services/discovery-save";
import { createCompanyInputSchema } from "@/features/companies/validation/company.schemas";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("buildDiscoveryCreateInput", () => {
  it("passes zod validation for typical Tavily result shapes", () => {
    const samples = [
      {
        name: "Acme Software BV",
        website: "https://www.acme.nl/about",
        sourceUrl: "https://www.acme.nl/about",
        city: "Amsterdam",
        sector: "IT",
      },
      {
        name: "Top 10 Beste software bedrijven van Nederland",
        website: "https://example.com/list",
        sourceUrl: "https://example.com/list",
      },
      {
        name: "Blog post without valid url",
        website: "not-a-valid-url",
        sourceUrl: "also bad",
      },
      {
        name: "Minimal",
        website: null,
        sourceUrl: null,
      },
    ];

    for (const sample of samples) {
      const input = buildDiscoveryCreateInput(
        {
          externalId: "tavily:test",
          name: sample.name,
          normalizedName: sample.name.toLowerCase(),
          website: sample.website,
          sourceUrl: sample.sourceUrl,
          city: sample.city ?? null,
          sector: sample.sector ?? null,
          source: "tavily",
          confidence: 0.65,
          vacancyCount: 0,
          vacancyTitles: [],
          hiringSignals: [],
          discoveredAt: new Date().toISOString(),
          lastVerifiedAt: null,
          domain: null,
          linkedinUrl: null,
          email: null,
          phone: null,
          region: null,
          province: null,
          country: "NL",
          employeeCountMin: null,
          employeeCountMax: null,
          employeeCountLabel: null,
          description: "Tavily snippet",
          careersUrl: null,
          vacancyPageUrl: null,
          generalEmail: null,
          hrEmail: null,
          kvkNumber: null,
          aiSummary: null,
        },
        USER_ID,
        "tavily",
      );

      const parsed = createCompanyInputSchema.safeParse(input);
      expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    }
  });
});
