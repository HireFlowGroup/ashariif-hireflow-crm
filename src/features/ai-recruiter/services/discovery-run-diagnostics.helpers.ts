import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type {
  RunDiagnostics,
  RunFailureCode,
  RunFailureUiMessage,
} from "@/features/ai-recruiter/domain/run-diagnostics";

export function buildRequestCriteriaFromPlan(plan: AiRecruiterSearchPlan): Record<string, unknown> {
  return {
    locations: plan.locations,
    regions: plan.regions,
    sectors: plan.sectors,
    employee_range: plan.employee_range,
    desired_roles: plan.desired_roles,
    maximum_companies: plan.maximum_companies,
    exclusions: plan.exclusions,
  };
}

export function classifyProviderError(message: string, httpStatus: number | null = null): RunFailureCode {
  const lower = message.toLowerCase();

  if (httpStatus === 401 || /unauthorized|authentication|invalid api key|401/.test(lower)) {
    return "provider_auth_failed";
  }
  if (httpStatus === 429 || /rate limit|too many requests|429|quota/.test(lower)) {
    return "provider_rate_limited";
  }
  if (/timeout|time-out|timed out|deadline|etimedout/.test(lower)) {
    return "provider_timeout";
  }
  if (/niet geconfigureerd|not configured|api_key|api key|tavily_api_key|geen actieve zoekproviders/.test(lower)) {
    return "provider_not_configured";
  }
  if (/supabase|database|postgres|opslaan mislukt|kon niet worden opgeslagen|duplicate key|rls/.test(lower)) {
    return "database_error";
  }
  if (/geen bedrijven opgeslagen|0 urls|no results|geen resultaten/.test(lower)) {
    return "no_results";
  }
  if (/afgewezen|rejected|quality gate|directories|geen echte bedrijven/.test(lower)) {
    return "no_valid_companies";
  }
  if (/provider|tavily|search|request failed|fetch failed|network/.test(lower)) {
    return "provider_request_failed";
  }

  return "unknown_error";
}

export function buildRunFailureUiMessage(
  diagnostics: RunDiagnostics,
  runStatus: string,
): RunFailureUiMessage | null {
  if (!diagnostics.errorCode && runStatus !== "failed" && runStatus !== "partially_completed") {
    return null;
  }

  if (diagnostics.errorCode === "no_results") {
    return {
      title: "Geen bedrijven gevonden",
      body: "De zoekopdracht leverde geen bedrijven op. Pas locatie, branche of zoekwoorden aan.",
      retryRecommended: true,
      showProviderSettings: false,
      providerName: diagnostics.providerName,
    };
  }

  if (diagnostics.errorCode === "no_valid_companies") {
    return {
      title: "Geen geldige bedrijven",
      body:
        diagnostics.errorMessage
        ?? "Zoekresultaten voldeden niet aan de kwaliteitscontrole. Verbreed locatie, branche of uitsluitingen.",
      retryRecommended: true,
      showProviderSettings: false,
      providerName: diagnostics.providerName,
    };
  }

  if (diagnostics.errorCode === "provider_not_configured") {
    return {
      title: "Zoekprovider niet geconfigureerd",
      body: `Discovery kon niet starten: ${diagnostics.providerName ?? "provider"} heeft geen geldige API-configuratie.`,
      retryRecommended: false,
      showProviderSettings: true,
      providerName: diagnostics.providerName,
    };
  }

  if (diagnostics.errorCode === "provider_auth_failed") {
    return {
      title: "Authenticatie mislukt bij zoekprovider",
      body: `De API-key voor ${diagnostics.providerName ?? "de provider"} is ongeldig of verlopen.`,
      retryRecommended: false,
      showProviderSettings: true,
      providerName: diagnostics.providerName,
    };
  }

  if (diagnostics.errorCode === "provider_rate_limited") {
    return {
      title: "Zoekprovider rate limit",
      body: `${diagnostics.providerName ?? "De provider"} blokkeert tijdelijk door te veel requests. Probeer het later opnieuw.`,
      retryRecommended: true,
      showProviderSettings: false,
      providerName: diagnostics.providerName,
    };
  }

  if (diagnostics.errorCode === "provider_timeout") {
    return {
      title: "Zoekprovider timeout",
      body: `${diagnostics.providerName ?? "De provider"} reageerde niet op tijd. Probeer opnieuw met smallere criteria.`,
      retryRecommended: true,
      showProviderSettings: false,
      providerName: diagnostics.providerName,
    };
  }

  if (diagnostics.errorCode === "database_error") {
    return {
      title: "Databasefout tijdens opslaan",
      body: diagnostics.errorMessage ?? "Bedrijven konden niet worden opgeslagen in de database.",
      retryRecommended: true,
      showProviderSettings: false,
      providerName: diagnostics.providerName,
    };
  }

  if (runStatus === "failed" || diagnostics.errorCode) {
    return {
      title: "AI Recruiter-run mislukt",
      body: diagnostics.errorMessage ?? "De run is mislukt zonder nadere details.",
      retryRecommended: diagnostics.retryRecommended,
      showProviderSettings: diagnostics.errorCode === "provider_request_failed",
      providerName: diagnostics.providerName,
    };
  }

  return null;
}

export function isProviderFailure(code: RunFailureCode | null): boolean {
  return (
    code === "provider_not_configured"
    || code === "provider_auth_failed"
    || code === "provider_rate_limited"
    || code === "provider_timeout"
    || code === "provider_request_failed"
  );
}

export function emptyDiscoverySummary(): DiscoveryEventSummary {
  return {
    providerName: null,
    responseCount: 0,
    normalizedCount: 0,
    rejectedCount: 0,
    rejectionReasons: [],
    lastErrorMessage: null,
    qualityReportRejected: 0,
    realCompanies: 0,
  };
}

export type DiscoveryEventSummary = {
  providerName: string | null;
  responseCount: number;
  normalizedCount: number;
  rejectedCount: number;
  rejectionReasons: string[];
  lastErrorMessage: string | null;
  qualityReportRejected: number;
  realCompanies: number;
};
