export type CandidateDiscoveryErrorCode =
  | "feature_disabled"
  | "vacancy_not_active"
  | "no_providers"
  | "no_search_capability"
  | "provider_failure"
  | "provider_quota"
  | "query_timeout"
  | "no_valid_profiles"
  | "all_queries_failed"
  | "invalid_vacancy"
  | "run_timeout";

const ERROR_MESSAGES_NL: Record<CandidateDiscoveryErrorCode, string> = {
  feature_disabled: "Kandidaatzoeken is niet ingeschakeld voor deze omgeving.",
  vacancy_not_active: "Kandidaatzoeken is alleen beschikbaar voor open vacatures.",
  no_providers: "Geen zoekproviders beschikbaar. Controleer de provider-instellingen.",
  no_search_capability: "Geen actieve zoekprovider met API-sleutel gevonden.",
  provider_failure: "Een zoekprovider kon de zoekopdracht niet voltooien.",
  provider_quota: "Zoekprovider-quota bereikt. Probeer later opnieuw of wissel van provider.",
  query_timeout: "Zoekopdracht afgebroken vanwege timeout.",
  no_valid_profiles: "Geen geldige LinkedIn-profiel-URL's in de zoekresultaten.",
  all_queries_failed: "Alle zoekopdrachten zijn mislukt — zie providerfouten voor details.",
  invalid_vacancy: "Vacature ontbreekt of is onvolledig voor zoekopdrachten.",
  run_timeout: "Kandidaatzoeken stopte vanwege het maximale tijdsbudget.",
};

export class CandidateDiscoveryError extends Error {
  readonly code: CandidateDiscoveryErrorCode;

  constructor(code: CandidateDiscoveryErrorCode, message?: string, options?: ErrorOptions) {
    super(message ?? ERROR_MESSAGES_NL[code], options);
    this.name = "CandidateDiscoveryError";
    this.code = code;
  }
}

export function candidateDiscoveryMessage(code: CandidateDiscoveryErrorCode): string {
  return ERROR_MESSAGES_NL[code];
}

export function classifyProviderSearchError(message: string): CandidateDiscoveryErrorCode {
  const lower = message.toLowerCase();
  if (/432|quota|rate.?limit|too many requests|429/.test(lower)) {
    return "provider_quota";
  }
  if (/timeout|time.?out|aborted|deadline/.test(lower)) {
    return "query_timeout";
  }
  return "provider_failure";
}