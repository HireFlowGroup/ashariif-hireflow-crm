import "server-only";

import type { CreateCompanyInput } from "@/features/companies/domain";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import type { ExternalCompanyCandidate as LeadCandidate } from "@/features/lead-intelligence/domain";
import { extractDomain } from "@/features/lead-intelligence/services/normalize";
import {
  discoveryUrlFallbackNote,
  sanitizeDiscoveryUrl,
} from "@/lib/company-finder/sanitize-discovery-url";

/** Minimal company record from discovery — enrichment is optional. */
export function buildDiscoveryCreateInput(
  candidate: LeadCandidate,
  _userId: string,
  sourceOverride?: string,
  metadata?: Pick<
    QualifiedDiscoveryCandidate,
    "companyType" | "companyConfidence" | "discoveryReason" | "discoveryProvider"
  >,
): CreateCompanyInput {
  const website = sanitizeDiscoveryUrl(candidate.website);
  const sourceUrl = sanitizeDiscoveryUrl(candidate.sourceUrl);

  return {
    name: candidate.name,
    website,
    domain: candidate.domain ?? extractDomain(website),
    city: candidate.city,
    region: candidate.region,
    province: candidate.province ?? candidate.region,
    sector: candidate.sector,
    source: sourceOverride ?? candidate.source ?? "tavily",
    sourceUrl,
    confidence: candidate.confidence,
    companyType: metadata?.companyType ?? null,
    companyConfidence: metadata?.companyConfidence ?? null,
    discoveryReason: metadata?.discoveryReason ?? null,
    discoveryProvider: metadata?.discoveryProvider ?? sourceOverride ?? candidate.source ?? "tavily",
    status: "prospect",
    notes: discoveryUrlFallbackNote(candidate.website ?? candidate.sourceUrl, candidate.description),
  };
}

export function buildQualifiedDiscoveryCreateInput(
  qualified: QualifiedDiscoveryCandidate,
  userId: string,
): CreateCompanyInput {
  return buildDiscoveryCreateInput(
    qualified.candidate,
    userId,
    qualified.discoveryProvider,
    qualified,
  );
}
