/** Client-safe intelligent search exports (types, filters, validation). */
export type {
  DerivedSearchFilters,
  FilterExtractionSource,
  FilterFieldKey,
} from "@/features/intelligent-search/domain/derived-filters";
export { EXAMPLE_SEARCH_QUERIES } from "@/features/intelligent-search/domain/derived-filters";
export {
  INTELLIGENT_SEARCH_PROVIDER_IDS,
  INTELLIGENT_SEARCH_PROVIDER_OPTIONS,
  type IntelligentSearchProviderId,
} from "@/features/intelligent-search/domain/provider-options";
export {
  derivedFiltersToCriteria,
  sanitizeAiExtractedFilters,
} from "@/features/intelligent-search/services/sanitize-derived-filters";
export { parseSearchQueryInputSchema } from "@/features/intelligent-search/validation/parse-query.schemas";
