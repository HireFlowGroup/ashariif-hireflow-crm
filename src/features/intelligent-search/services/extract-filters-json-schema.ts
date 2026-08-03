import { HIRING_SIGNAL_TYPES } from "@/features/hiring-intelligence/domain/signal-types";
import { INTELLIGENT_SEARCH_PROVIDER_IDS } from "@/features/intelligent-search/domain/provider-options";

const fieldSourceSchema = {
  type: "string",
  enum: ["explicit", "inferred", "none"],
} as const;

/** OpenAI Structured Outputs schema for company search filter extraction. */
export const EXTRACT_COMPANY_SEARCH_FILTERS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    city: {
      type: ["string", "null"],
      description: "Stad/plaats, bijv. Amsterdam. Null als niet genoemd.",
    },
    region: {
      type: ["string", "null"],
      description: "Provincie/regio, bijv. Noord-Holland. Null als niet genoemd.",
    },
    sector: {
      type: ["string", "null"],
      description: "Branche/sector zoals genoemd. Null als niet genoemd.",
    },
    employeeCountMin: {
      type: ["number", "null"],
      description: "Minimum aantal medewerkers. Null als niet genoemd.",
    },
    employeeCountMax: {
      type: ["number", "null"],
      description: "Maximum aantal medewerkers. Null als niet genoemd.",
    },
    employeeCountRange: {
      type: ["string", "null"],
      enum: ["1-10", "11-50", "51-200", "201-1000", "1000+", null],
      description: "Berekende range-bucket. Null als omvang niet genoemd.",
    },
    vacancyTitles: {
      type: "array",
      items: { type: "string" },
      description: "Vacaturetitels/rollen expliciet genoemd.",
    },
    hiringSignalTypes: {
      type: "array",
      items: {
        type: "string",
        enum: Object.keys(HIRING_SIGNAL_TYPES),
      },
      description: "Hiring signals impliciet of expliciet in de vraag.",
    },
    keywords: {
      type: ["string", "null"],
      description: "Overige zoekwoorden uit de prompt. Null als niet van toepassing.",
    },
    providerIds: {
      type: "array",
      items: {
        type: "string",
        enum: [...INTELLIGENT_SEARCH_PROVIDER_IDS],
      },
      description: "Alleen invullen als de prompt een specifieke bron noemt.",
    },
    searchVacancies: {
      type: ["boolean", "null"],
      description: "True als vacatures/rollen/hiring centraal staan.",
    },
    maxResults: {
      type: ["number", "null"],
      description: "Aantal resultaten als expliciet genoemd.",
    },
    reasoning: {
      type: "string",
      description: "Korte NL uitleg (2-4 zinnen) welke filters zijn afgeleid.",
    },
    fieldSources: {
      type: "object",
      additionalProperties: false,
      properties: {
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
      },
      required: [
        "city",
        "region",
        "sector",
        "employeeCountMin",
        "employeeCountMax",
        "employeeCountRange",
        "vacancyTitles",
        "hiringSignalTypes",
        "keywords",
        "providerIds",
        "searchVacancies",
        "maxResults",
      ],
    },
  },
  required: [
    "city",
    "region",
    "sector",
    "employeeCountMin",
    "employeeCountMax",
    "employeeCountRange",
    "vacancyTitles",
    "hiringSignalTypes",
    "keywords",
    "providerIds",
    "searchVacancies",
    "maxResults",
    "reasoning",
    "fieldSources",
  ],
} as const;

export const EXTRACT_COMPANY_SEARCH_FILTERS_SCHEMA_NAME = "company_search_filters";
