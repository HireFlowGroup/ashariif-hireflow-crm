import { z } from "zod";

import { employeeCountRangeSchema } from "@/features/company-finder/validation/finder.schemas";
import { HIRING_SIGNAL_TYPES } from "@/features/hiring-intelligence/domain/signal-types";
import { INTELLIGENT_SEARCH_PROVIDER_IDS } from "@/features/intelligent-search/domain/provider-options";

const hiringSignalTypeSchema = z.enum(
  Object.keys(HIRING_SIGNAL_TYPES) as [string, ...string[]],
);

export const parseSearchQueryInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(3, "Beschrijf je zoekopdracht in minimaal 3 tekens.")
    .max(500, "Zoekopdracht is te lang (max. 500 tekens)."),
});

const fieldSourceSchema = z.enum(["explicit", "inferred", "none"]);

export const aiExtractedFieldSourcesSchema = z.object({
  city: fieldSourceSchema,
  region: fieldSourceSchema,
  sector: fieldSourceSchema,
  employeeCountMin: fieldSourceSchema,
  employeeCountMax: fieldSourceSchema,
  employeeCountRange: fieldSourceSchema,
  vacancyTitles: fieldSourceSchema,
  hiringSignalTypes: fieldSourceSchema,
  keywords: fieldSourceSchema,
  providerIds: fieldSourceSchema,
  searchVacancies: fieldSourceSchema,
  maxResults: fieldSourceSchema,
});

/** Raw structured output van OpenAI — velden null wanneer niet in prompt. */
export const aiExtractedFiltersSchema = z.object({
  city: z.string().nullable(),
  region: z.string().nullable(),
  sector: z.string().nullable(),
  employeeCountMin: z.number().int().positive().nullable(),
  employeeCountMax: z.number().int().positive().nullable(),
  employeeCountRange: employeeCountRangeSchema.nullable(),
  vacancyTitles: z.array(z.string()),
  hiringSignalTypes: z.array(hiringSignalTypeSchema),
  keywords: z.string().nullable(),
  providerIds: z.array(z.enum(INTELLIGENT_SEARCH_PROVIDER_IDS)),
  searchVacancies: z.boolean().nullable(),
  maxResults: z.number().int().min(1).max(100).nullable(),
  reasoning: z.string().min(1),
  fieldSources: aiExtractedFieldSourcesSchema,
});

export type AiExtractedFilters = z.infer<typeof aiExtractedFiltersSchema>;
