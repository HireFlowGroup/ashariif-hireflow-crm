import { z } from "zod";

import { HIRING_SIGNAL_TYPES } from "@/features/hiring-intelligence/domain/signal-types";
import { INTELLIGENT_SEARCH_PROVIDER_IDS } from "@/features/intelligent-search/domain/provider-options";

export const employeeCountRangeSchema = z.enum([
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
]);

const hiringSignalTypeSchema = z.enum(
  Object.keys(HIRING_SIGNAL_TYPES) as [string, ...string[]],
);

const providerIdSchema = z.enum(INTELLIGENT_SEARCH_PROVIDER_IDS);

function hasSearchDimensions(value: {
  city?: string;
  region?: string;
  sector?: string;
  keywords?: string;
  vacancyTitles?: string[];
  hiringSignalTypes?: string[];
}): boolean {
  return Boolean(
    value.city?.trim()
    || value.region?.trim()
    || value.sector?.trim()
    || value.keywords?.trim()
    || (value.vacancyTitles?.length ?? 0) > 0
    || (value.hiringSignalTypes?.length ?? 0) > 0,
  );
}

export const companyFinderCriteriaSchema = z.object({
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  sector: z.string().trim().max(120).optional(),
  keywords: z.string().trim().max(200).optional(),
  employeeCountRange: employeeCountRangeSchema.optional(),
  employeeCountMin: z.number().int().positive().optional(),
  employeeCountMax: z.number().int().positive().optional(),
  vacancyTitles: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  hiringSignalTypes: z.array(hiringSignalTypeSchema).max(10).optional(),
  providerIds: z.array(providerIdSchema).max(10).optional(),
  searchVacancies: z.boolean().optional(),
  maxResults: z.coerce.number().int().min(1).max(100).optional(),
  excludedNames: z.array(z.string().trim().max(120)).max(20).optional(),
  excludedSectors: z.array(z.string().trim().max(120)).max(20).optional(),
  sourceQuery: z.string().trim().max(500).optional(),
  fastMode: z.boolean().optional().default(true),
}).refine(hasSearchDimensions, {
  message: "Vul minimaal plaats, regio, branche, zoekwoorden, vacaturetitels of hiring signals in.",
});

export const createCompanySearchJobSchema = companyFinderCriteriaSchema;

export const companySearchJobIdSchema = z.object({
  jobId: z.string().uuid("Ongeldige job-id."),
});
