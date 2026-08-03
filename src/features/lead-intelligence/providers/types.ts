import type {
  CompanySearchCriteria,
  ExternalCompanyCandidate,
  ProviderContext,
} from "@/features/lead-intelligence/domain";

export interface CompanySearchProvider {
  readonly name: string;
  readonly enabled: boolean;
  readonly skipReason?: string;

  search(
    criteria: CompanySearchCriteria,
    context: ProviderContext,
  ): Promise<ExternalCompanyCandidate[]>;
}

export interface CompanyEnrichmentProvider {
  readonly name: string;
  readonly enabled: boolean;

  enrich(candidate: ExternalCompanyCandidate): Promise<ExternalCompanyCandidate>;
}

export interface VacancyDetectionProvider {
  readonly name: string;
  readonly enabled: boolean;

  detect(
    candidate: ExternalCompanyCandidate,
  ): Promise<ExternalCompanyCandidate>;
}

export function createEmptyCandidate(
  partial: Partial<ExternalCompanyCandidate> & Pick<ExternalCompanyCandidate, "externalId" | "name" | "source">,
): ExternalCompanyCandidate {
  const now = new Date().toISOString();

  return {
    externalId: partial.externalId,
    name: partial.name,
    normalizedName: partial.normalizedName ?? partial.name.toLowerCase(),
    website: partial.website ?? null,
    domain: partial.domain ?? null,
    linkedinUrl: partial.linkedinUrl ?? null,
    email: partial.email ?? null,
    phone: partial.phone ?? null,
    city: partial.city ?? null,
    region: partial.region ?? null,
    province: partial.province ?? partial.region ?? null,
    country: partial.country ?? "NL",
    sector: partial.sector ?? null,
    employeeCountMin: partial.employeeCountMin ?? null,
    employeeCountMax: partial.employeeCountMax ?? null,
    employeeCountLabel: partial.employeeCountLabel ?? null,
    description: partial.description ?? null,
    careersUrl: partial.careersUrl ?? null,
    vacancyPageUrl: partial.vacancyPageUrl ?? null,
    generalEmail: partial.generalEmail ?? null,
    hrEmail: partial.hrEmail ?? null,
    kvkNumber: partial.kvkNumber ?? null,
    aiSummary: partial.aiSummary ?? null,
    source: partial.source,
    sourceUrl: partial.sourceUrl ?? null,
    vacancyCount: partial.vacancyCount ?? 0,
    vacancyTitles: partial.vacancyTitles ?? [],
    hiringSignals: partial.hiringSignals ?? [],
    confidence: partial.confidence ?? 0.5,
    discoveredAt: partial.discoveredAt ?? now,
    lastVerifiedAt: partial.lastVerifiedAt ?? null,
  };
}
