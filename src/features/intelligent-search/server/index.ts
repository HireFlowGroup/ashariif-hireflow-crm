import "server-only";

/** Server-only intelligent search (OpenAI parsing). */
export {
  IntelligentSearchParserError,
  parseRecruitmentSearchQuery,
  type ParseSearchQueryResult,
} from "@/features/intelligent-search/services/intelligent-search-parser.service";
