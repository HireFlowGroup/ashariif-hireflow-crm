import { describe, expect, it } from "vitest";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import {
  aiExtractedFiltersSchema,
} from "@/features/intelligent-search/validation/parse-query.schemas";
import { sanitizeAiExtractedFilters } from "@/features/intelligent-search/services/sanitize-derived-filters";

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

describe("extractApiErrorMessage", () => {
  it("reads nested API error envelope messages", () => {
    expect(
      extractApiErrorMessage(
        { error: { code: "VALIDATION_ERROR", message: "Kon geen zoekfilters afleiden uit je prompt." } },
        "fallback",
      ),
    ).toBe("Kon geen zoekfilters afleiden uit je prompt.");
  });

  it("falls back when no message exists", () => {
    expect(extractApiErrorMessage({}, "Kon zoekfilters niet afleiden.")).toBe(
      "Kon zoekfilters niet afleiden.",
    );
  });
});

describe("intelligent search structured output", () => {
  it("validates OpenAI JSON against Zod before sanitizing", () => {
    const raw = {
      city: null,
      region: null,
      sector: null,
      employeeCountMin: 20,
      employeeCountMax: 100,
      employeeCountRange: null,
      vacancyTitles: [],
      hiringSignalTypes: [],
      keywords: null,
      providerIds: [],
      searchVacancies: null,
      maxResults: null,
      reasoning: "Employee range expliciet genoemd.",
      fieldSources: {
        ...baseFieldSources,
        employeeCountMin: "explicit",
        employeeCountMax: "explicit",
      },
    };

    const parsed = aiExtractedFiltersSchema.parse(raw);
    const filters = sanitizeAiExtractedFilters(parsed);

    expect(filters.employeeCountMin).toBe(20);
    expect(filters.employeeCountMax).toBe(100);
    expect(filters.city).toBeNull();
  });

  it("rejects incomplete fieldSources objects", () => {
    const result = aiExtractedFiltersSchema.safeParse({
      city: "Amsterdam",
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
      reasoning: "test",
      fieldSources: { city: "explicit" },
    });

    expect(result.success).toBe(false);
  });
});
