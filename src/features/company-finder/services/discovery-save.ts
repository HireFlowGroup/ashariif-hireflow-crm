import "server-only";

import type { CreateCompanyInput } from "@/features/companies/domain";
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
    status: "prospect",
    notes: discoveryUrlFallbackNote(candidate.website ?? candidate.sourceUrl, candidate.description),
  };
}
