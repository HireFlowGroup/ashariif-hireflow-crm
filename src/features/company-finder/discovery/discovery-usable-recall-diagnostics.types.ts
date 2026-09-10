/** Explicit discovery recall diagnostics surfaced after every run. */
export type UsableRecallDiagnostics = {
  TAVILY_RAW: number;
  TAVILY_USABLE: number;
  TAVILY_EMPLOYERS: number;
  TAVILY_CONCRETE_VACANCIES: number;
  TAVILY_DESIRED_ROLE_MATCHES: number;
  TAVILY_LOCATION_COVERAGE: Record<string, number>;
  TAVILY_ROLE_COVERAGE: Record<string, number>;
  SERPAPI_RAW: number;
  SERPAPI_USABLE: number;
  SERPAPI_FALLBACK_TRIGGERED: boolean;
  SERPAPI_FALLBACK_REASON: string | null;
  SERPAPI_SUPPLEMENTAL_QUERIES: number;
};

export type RecallCoverageGap = {
  location: string;
  role: string;
  reason: string;
};
