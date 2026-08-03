import type { CompanySearchCriteria, ExternalCompanyCandidate, ProviderContext } from "@/features/lead-intelligence/domain";

/** Modular discovery provider — add Apollo, Hunter, Crunchbase later via registerDiscoveryProvider. */
export interface RecruitmentDiscoveryProvider {
  readonly id: string;
  readonly displayName: string;
  readonly order: number;
  readonly enabled: boolean;
  readonly skipReason?: string;
  discover(
    criteria: CompanySearchCriteria,
    context: ProviderContext,
  ): Promise<ExternalCompanyCandidate[]>;
}

export interface RecruitmentEnrichmentProvider {
  readonly id: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly skipReason?: string;
  enrich(candidate: ExternalCompanyCandidate): Promise<ExternalCompanyCandidate>;
}

export type ProviderRegistryEntry = {
  name: string;
  enabled: boolean;
  reason?: string;
};
