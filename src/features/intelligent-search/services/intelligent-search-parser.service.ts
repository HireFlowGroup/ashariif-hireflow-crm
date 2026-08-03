import "server-only";

import { SECTOR_OPTIONS } from "@/features/lead-intelligence/domain";
import { HIRING_SIGNAL_TYPES } from "@/features/hiring-intelligence/domain/signal-types";
import type { DerivedSearchFilters } from "@/features/intelligent-search/domain/derived-filters";
import {
  EXTRACT_COMPANY_SEARCH_FILTERS_JSON_SCHEMA,
  EXTRACT_COMPANY_SEARCH_FILTERS_SCHEMA_NAME,
} from "@/features/intelligent-search/services/extract-filters-json-schema";
import {
  derivedFiltersToCriteria,
  sanitizeAiExtractedFilters,
} from "@/features/intelligent-search/services/sanitize-derived-filters";
import {
  aiExtractedFiltersSchema,
  type AiExtractedFilters,
} from "@/features/intelligent-search/validation/parse-query.schemas";
import { DEFAULT_MODEL } from "@/lib/ai/config";
import { getOpenAIClient } from "@/lib/ai/client";
import { isOpenAIConfigured } from "@/platform/config/env";
import { createLogger, type Logger } from "@/platform/observability/logger";

export class IntelligentSearchParserError extends Error {
  constructor(
    message: string,
    readonly code: "OPENAI_NOT_CONFIGURED" | "PARSE_FAILED" | "INVALID_OUTPUT" = "PARSE_FAILED",
  ) {
    super(message);
    this.name = "IntelligentSearchParserError";
  }
}

const parserLogger = createLogger({ module: "intelligent-search-parser" });

function buildSystemPrompt(): string {
  const sectors = SECTOR_OPTIONS.join(", ");
  const signals = Object.entries(HIRING_SIGNAL_TYPES)
    .map(([slug, meta]) => `${slug} (${meta.label})`)
    .join(", ");

  return `Je bent een recruitment intelligence parser voor Nederlandse B2B lead-zoekopdrachten.

STRICTE REGELS — GEEN HALLUCINATIES:
1. Extraheer ALLEEN informatie die expliciet in de gebruikersprompt staat of daar direct uit volgt.
2. Gebruik null voor city/region/sector/keywords/employee counts wanneer niet genoemd.
3. Gebruik lege arrays voor vacancyTitles, hiringSignalTypes, providerIds wanneer niet van toepassing.
4. Verzín GEEN plaats, regio, branche, bedrijfsomvang of vacaturetitel die niet in de prompt staat.
5. Bij "bedrijven zoeken recruiters" → hiringSignalTypes: ["new_recruiter"], searchVacancies: true.
6. Bij "met planners" / "Customer Success Managers zoeken" → vacancyTitles met die rollen.
7. Bij "20-100 medewerkers" → employeeCountMin: 20, employeeCountMax: 100.
8. ProviderIds ALLEEN invullen als Indeed, LinkedIn, Google Maps, etc. expliciet genoemd wordt.
9. sector: kies de dichtstbijzijnde match uit: ${sectors}. Null als geen branche genoemd.
10. hiringSignalTypes opties: ${signals}.
11. Leg in reasoning uit wat je wél en niet hebt gevonden.

Antwoord uitsluitend als JSON volgens het schema. Geen vrije tekst buiten het JSON-object.`;
}

function logStage(
  logger: Logger,
  stage: string,
  data: Record<string, unknown>,
): void {
  logger.info(`intelligent-search.${stage}`, data);
}

function parseStructuredContent(rawContent: string | null | undefined, logger: Logger): AiExtractedFilters {
  if (!rawContent?.trim()) {
    logStage(logger, "parse.error", { reason: "empty_content" });
    throw new IntelligentSearchParserError("AI-antwoord was leeg.", "INVALID_OUTPUT");
  }

  let json: unknown;

  try {
    json = JSON.parse(rawContent);
  } catch (error) {
    logStage(logger, "parse.error", {
      reason: "json_parse_failed",
      content: rawContent,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new IntelligentSearchParserError("AI-antwoord kon niet worden gelezen.", "INVALID_OUTPUT");
  }

  logStage(logger, "parsed_json", { json });

  const parsed = aiExtractedFiltersSchema.safeParse(json);

  if (!parsed.success) {
    logStage(logger, "parse.error", {
      reason: "zod_validation_failed",
      issues: parsed.error.issues,
      content: rawContent,
    });
    throw new IntelligentSearchParserError(
      "AI-antwoord voldeed niet aan het verwachte schema.",
      "INVALID_OUTPUT",
    );
  }

  return parsed.data;
}

function hasDerivedFilters(filters: DerivedSearchFilters): boolean {
  return Boolean(
    filters.city
    || filters.region
    || filters.sector
    || filters.keywords
    || filters.employeeCountMin
    || filters.employeeCountMax
    || filters.employeeCountRange
    || filters.vacancyTitles.length > 0
    || filters.hiringSignalTypes.length > 0
    || filters.providerIds.length > 0
    || filters.searchVacancies === true
    || filters.maxResults,
  );
}

export type ParseSearchQueryResult = {
  filters: DerivedSearchFilters;
  criteria: ReturnType<typeof derivedFiltersToCriteria>;
};

export type ParseRecruitmentSearchQueryOptions = {
  requestId?: string;
};

export async function parseRecruitmentSearchQuery(
  query: string,
  options: ParseRecruitmentSearchQueryOptions = {},
): Promise<ParseSearchQueryResult> {
  const logger = options.requestId
    ? createLogger({ module: "intelligent-search-parser", requestId: options.requestId })
    : parserLogger;

  const trimmedQuery = query.trim();

  logStage(logger, "request", {
    query: trimmedQuery,
    openAiConfigured: isOpenAIConfigured(),
    hasEnvKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });

  if (!isOpenAIConfigured()) {
    throw new IntelligentSearchParserError(
      "OpenAI is niet geconfigureerd. Stel OPENAI_API_KEY in om intelligente zoekopdrachten te gebruiken.",
      "OPENAI_NOT_CONFIGURED",
    );
  }

  const client = getOpenAIClient();
  const model = DEFAULT_MODEL;

  logStage(logger, "model", { model, responseFormat: "json_schema" });

  let response;

  try {
    response = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: trimmedQuery },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: EXTRACT_COMPANY_SEARCH_FILTERS_SCHEMA_NAME,
          strict: true,
          schema: EXTRACT_COMPANY_SEARCH_FILTERS_JSON_SCHEMA,
        },
      },
    });
  } catch (error) {
    logStage(logger, "openai.error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }

  logStage(logger, "raw_response", {
    id: response.id,
    model: response.model,
    finishReason: response.choices[0]?.finish_reason,
    content: response.choices[0]?.message?.content,
    usage: response.usage,
  });

  const content = response.choices[0]?.message?.content;
  const extracted = parseStructuredContent(content, logger);
  const filters = sanitizeAiExtractedFilters(extracted);

  logStage(logger, "validated_filters", { filters });

  if (!hasDerivedFilters(filters)) {
    logStage(logger, "parse.error", {
      reason: "no_usable_filters",
      filters,
    });
    throw new IntelligentSearchParserError(
      "Kon geen zoekfilters afleiden uit je prompt. Probeer specifieker te zijn (plaats, branche, rol of hiring signaal).",
      "PARSE_FAILED",
    );
  }

  const result = {
    filters,
    criteria: derivedFiltersToCriteria(filters, trimmedQuery),
  };

  logStage(logger, "return_to_ui", {
    filterCount: Object.keys(result.filters).length,
    criteriaKeys: Object.keys(result.criteria),
  });

  return result;
}
