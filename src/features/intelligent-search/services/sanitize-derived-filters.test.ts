import { describe, expect, it } from "vitest";

import {
  derivedFiltersToCriteria,
  sanitizeAiExtractedFilters,
} from "@/features/intelligent-search/services/sanitize-derived-filters";
import type { AiExtractedFilters } from "@/features/intelligent-search/validation/parse-query.schemas";

const baseFieldSources = {
  city: "none" as const,
  region: "none" as const,
  sector: "none" as const,
  employeeCountMin: "none" as const,
  employeeCountMax: "none" as const,
  employeeCountRange: "none" as const,
  vacancyTitles: "none" as const,
  hiringSignalTypes: "none" as const,
  keywords: "none" as const,
  providerIds: "none" as const,
  searchVacancies: "none" as const,
  maxResults: "none" as const,
};

function buildRaw(overrides: Partial<AiExtractedFilters>): AiExtractedFilters {
  return {
    city: null,
    region: null,
    sector: null,
    employeeCountMin: null,
    employeeCountMax: null,
    employeeCountRange: null,
    vacancyTitles: [],
    hiringSignalTypes: [],
    keywords: null,
    providerIds: [],
    searchVacancies: null,
    maxResults: null,
    reasoning: "Test",
    fieldSources: baseFieldSources,
    ...overrides,
  };
}

describe("sanitizeAiExtractedFilters", () => {
  it("maps software sector and employee range from explicit prompt", () => {
    const filters = sanitizeAiExtractedFilters(
      buildRaw({
        city: "Amsterdam",
        sector: "software",
        employeeCountMin: 20,
        employeeCountMax: 100,
        reasoning: "Amsterdam en software expliciet genoemd.",
        fieldSources: {
          ...baseFieldSources,
          city: "explicit",
          sector: "explicit",
          employeeCountMin: "explicit",
          employeeCountMax: "explicit",
        },
      }),
    );

    expect(filters.city).toBe("Amsterdam");
    expect(filters.sector).toBe("Software en SaaS");
    expect(filters.employeeCountMin).toBe(20);
    expect(filters.employeeCountMax).toBe(100);
    expect(filters.employeeCountRange).toBe("51-200");
  });

  it("derives recruiter hiring signal without inventing location", () => {
    const filters = sanitizeAiExtractedFilters(
      buildRaw({
        hiringSignalTypes: ["new_recruiter"],
        searchVacancies: true,
        reasoning: "Recruiter hiring signaal.",
        fieldSources: {
          ...baseFieldSources,
          hiringSignalTypes: "explicit",
          searchVacancies: "inferred",
        },
      }),
    );

    expect(filters.city).toBeNull();
    expect(filters.region).toBeNull();
    expect(filters.hiringSignalTypes).toContain("new_recruiter");
    expect(filters.searchVacancies).toBe(true);
  });

  it("keeps vacancy titles separate from keywords", () => {
    const filters = sanitizeAiExtractedFilters(
      buildRaw({
        sector: "Logistiek",
        vacancyTitles: ["planner"],
        fieldSources: {
          ...baseFieldSources,
          sector: "explicit",
          vacancyTitles: "explicit",
        },
      }),
    );

    expect(filters.vacancyTitles).toEqual(["planner"]);
    expect(filters.keywords).toBeNull();
  });
});

describe("derivedFiltersToCriteria", () => {
  it("produces valid job criteria with hiring signals and providers", () => {
    const filters = sanitizeAiExtractedFilters(
      buildRaw({
        sector: "SaaS",
        vacancyTitles: ["Customer Success Manager"],
        hiringSignalTypes: ["vacancy"],
        providerIds: ["signals-indeed"],
        searchVacancies: true,
        maxResults: 25,
      }),
    );

    const criteria = derivedFiltersToCriteria(filters, "Zoek SaaS CSM");

    expect(criteria.sector).toBe("Software en SaaS");
    expect(criteria.vacancyTitles).toEqual(["Customer Success Manager"]);
    expect(criteria.hiringSignalTypes).toContain("vacancy");
    expect(criteria.providerIds).toEqual(["signals-indeed"]);
    expect(criteria.searchVacancies).toBe(true);
    expect(criteria.maxResults).toBe(25);
    expect(criteria.sourceQuery).toBe("Zoek SaaS CSM");
  });
});
