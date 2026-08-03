import type { EmployeeCountRange } from "@/features/company-finder/domain";
import type { HiringSignalType } from "@/features/hiring-intelligence/domain/signal-types";
import type { IntelligentSearchProviderId } from "@/features/intelligent-search/domain/provider-options";

export type FilterFieldKey =
  | "city"
  | "region"
  | "sector"
  | "employeeCountMin"
  | "employeeCountMax"
  | "employeeCountRange"
  | "vacancyTitles"
  | "hiringSignalTypes"
  | "keywords"
  | "providerIds"
  | "searchVacancies"
  | "maxResults";

export type FilterExtractionSource = "explicit" | "inferred" | "none";

export type DerivedSearchFilters = {
  city: string | null;
  region: string | null;
  sector: string | null;
  employeeCountMin: number | null;
  employeeCountMax: number | null;
  employeeCountRange: EmployeeCountRange | null;
  vacancyTitles: string[];
  hiringSignalTypes: HiringSignalType[];
  keywords: string | null;
  providerIds: IntelligentSearchProviderId[];
  searchVacancies: boolean | null;
  maxResults: number | null;
  /** Korte NL uitleg wat AI uit de prompt haalde */
  reasoning: string;
  /** Per veld: expliciet in prompt, afgeleid, of niet ingevuld */
  fieldSources: Partial<Record<FilterFieldKey, FilterExtractionSource>>;
};

export const EXAMPLE_SEARCH_QUERIES = [
  "Zoek softwarebedrijven in Amsterdam met 20-100 medewerkers.",
  "Zoek logistieke bedrijven met planners.",
  "Welke bedrijven zoeken recruiters?",
  "Zoek SaaS bedrijven die Customer Success Managers zoeken.",
] as const;
