import type { CompanyFinderCriteria } from "@/features/company-finder/domain";
import type { EmployeeCountRange } from "@/features/company-finder/domain";
import { SECTOR_OPTIONS } from "@/features/lead-intelligence/domain";
import type { HiringSignalType } from "@/features/hiring-intelligence/domain/signal-types";
import { HIRING_SIGNAL_TYPES } from "@/features/hiring-intelligence/domain/signal-types";
import type { DerivedSearchFilters } from "@/features/intelligent-search/domain/derived-filters";
import {
  INTELLIGENT_SEARCH_PROVIDER_IDS,
  PROVIDER_ALIASES,
  type IntelligentSearchProviderId,
} from "@/features/intelligent-search/domain/provider-options";
import type { AiExtractedFilters } from "@/features/intelligent-search/validation/parse-query.schemas";

const VALID_SIGNAL_TYPES = new Set(Object.keys(HIRING_SIGNAL_TYPES));
const VALID_PROVIDER_IDS = new Set<string>(INTELLIGENT_SEARCH_PROVIDER_IDS);

const SECTOR_ALIASES: Record<string, string> = {
  software: "Software en SaaS",
  saas: "Software en SaaS",
  "software en saas": "Software en SaaS",
  it: "IT-dienstverlening",
  tech: "IT-dienstverlening",
  logistiek: "Logistiek",
  logistics: "Logistiek",
  accountancy: "Accountancy",
  administratie: "Administratie en belastingadvies",
  techniek: "Techniek",
  installatie: "Installatie",
  advies: "Ingenieurs- en adviesbureaus",
  consulting: "Zakelijke dienstverlening",
};

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveSector(raw: string | null): string | null {
  if (!raw) return null;

  const lower = raw.toLowerCase().trim();

  if (SECTOR_ALIASES[lower]) {
    return SECTOR_ALIASES[lower];
  }

  const exact = SECTOR_OPTIONS.find((option) => option.toLowerCase() === lower);
  if (exact) return exact;

  const partial = SECTOR_OPTIONS.find(
    (option) => option.toLowerCase().includes(lower) || lower.includes(option.toLowerCase()),
  );

  return partial ?? null;
}

function resolveProviderId(raw: string): IntelligentSearchProviderId | null {
  const normalized = raw.trim().toLowerCase();

  if (VALID_PROVIDER_IDS.has(normalized)) {
    return normalized as IntelligentSearchProviderId;
  }

  return PROVIDER_ALIASES[normalized] ?? null;
}

function resolveHiringSignalType(raw: string): HiringSignalType | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "_");

  if (VALID_SIGNAL_TYPES.has(normalized)) {
    return normalized as HiringSignalType;
  }

  if (normalized.includes("recruiter")) return "new_recruiter";
  if (normalized.includes("hr_manager") || normalized.includes("hr manager")) {
    return "new_hr_manager";
  }
  if (normalized.includes("vacature") || normalized.includes("vacancy")) return "vacancy";
  if (normalized.includes("indeed")) return "indeed_vacancy";
  if (normalized.includes("linkedin")) return "linkedin_hiring";
  if (normalized.includes("werken") || normalized.includes("careers")) return "careers_page";
  if (normalized.includes("funding") || normalized.includes("investering")) return "funding";

  return null;
}

function minMaxToRange(min: number | null, max: number | null): EmployeeCountRange | null {
  if (min === null && max === null) return null;

  const effectiveMin = min ?? 1;
  const effectiveMax = max ?? effectiveMin;

  if (effectiveMax <= 10) return "1-10";
  if (effectiveMin >= 11 && effectiveMax <= 50) return "11-50";
  if (effectiveMin >= 51 && effectiveMax <= 200) return "51-200";
  if (effectiveMin >= 201 && effectiveMax <= 1000) return "201-1000";
  if (effectiveMin >= 1000) return "1000+";

  if (effectiveMax <= 50) return "11-50";
  if (effectiveMax <= 200) return "51-200";
  if (effectiveMax <= 1000) return "201-1000";

  return "1000+";
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function sanitizeAiExtractedFilters(raw: AiExtractedFilters): DerivedSearchFilters {
  const city = normalizeText(raw.city);
  const region = normalizeText(raw.region);
  const sector = resolveSector(normalizeText(raw.sector));
  const keywords = normalizeText(raw.keywords);

  const employeeCountMin = raw.employeeCountMin ?? null;
  const employeeCountMax = raw.employeeCountMax ?? null;
  const employeeCountRange =
    raw.employeeCountRange ?? minMaxToRange(employeeCountMin, employeeCountMax);

  const vacancyTitles = dedupeStrings(raw.vacancyTitles).slice(0, 10);

  const hiringSignalTypes = dedupeStrings(raw.hiringSignalTypes)
    .map(resolveHiringSignalType)
    .filter((value): value is HiringSignalType => value !== null)
    .slice(0, 10);

  const providerIds = dedupeStrings(raw.providerIds)
    .map(resolveProviderId)
    .filter((value): value is IntelligentSearchProviderId => value !== null)
    .slice(0, 10);

  const unresolvedSector = normalizeText(raw.sector);
  const extraKeywords = sector ? null : unresolvedSector;

  const mergedKeywords = [keywords, extraKeywords].filter(Boolean).join(" ").trim() || null;

  const searchVacancies =
    raw.searchVacancies
    ?? (vacancyTitles.length > 0
      || hiringSignalTypes.some((type) =>
        ["vacancy", "indeed_vacancy", "careers_page", "linkedin_hiring", "new_recruiter"].includes(type),
      )
      ? true
      : null);

  const fieldSources = { ...raw.fieldSources };

  if (extraKeywords && !sector) {
    fieldSources.sector = "none";
    fieldSources.keywords = fieldSources.keywords ?? "inferred";
  }

  return {
    city,
    region,
    sector,
    employeeCountMin,
    employeeCountMax,
    employeeCountRange,
    vacancyTitles,
    hiringSignalTypes,
    keywords: mergedKeywords,
    providerIds,
    searchVacancies,
    maxResults: raw.maxResults,
    reasoning: raw.reasoning.trim(),
    fieldSources,
  };
}

export function derivedFiltersToCriteria(
  filters: DerivedSearchFilters,
  sourceQuery?: string,
): CompanyFinderCriteria {
  const criteria: CompanyFinderCriteria = {
    sourceQuery,
  };

  if (filters.city) criteria.city = filters.city;
  if (filters.region) criteria.region = filters.region;
  if (filters.sector) criteria.sector = filters.sector;
  if (filters.keywords) criteria.keywords = filters.keywords;
  if (filters.employeeCountRange) criteria.employeeCountRange = filters.employeeCountRange;
  if (filters.employeeCountMin) criteria.employeeCountMin = filters.employeeCountMin;
  if (filters.employeeCountMax) criteria.employeeCountMax = filters.employeeCountMax;
  if (filters.vacancyTitles.length) criteria.vacancyTitles = filters.vacancyTitles;
  if (filters.hiringSignalTypes.length) {
    criteria.hiringSignalTypes = filters.hiringSignalTypes;
  }
  if (filters.providerIds.length) criteria.providerIds = filters.providerIds;
  if (filters.searchVacancies !== null) criteria.searchVacancies = filters.searchVacancies;
  if (filters.maxResults) criteria.maxResults = filters.maxResults;

  return criteria;
}
