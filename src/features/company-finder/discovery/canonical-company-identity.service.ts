import { resolveOfficialDomain } from "@/features/company-finder/discovery/discovery-domain-blocklist";
import {
  createCandidateKey,
  extractDomain,
  normalizeCompanyName,
  normalizeWebsite,
} from "@/features/lead-intelligence/services/normalize";

export type CanonicalIdentityMatchStrength = "domain" | "external_id" | "name_city" | "weak_name";

export type CanonicalCompanyIdentity = {
  canonicalDomain: string | null;
  normalizedName: string;
  normalizedWebsite: string | null;
  /** Stable dedupe key within a tenant/run (prefers domain). */
  dedupeKey: string;
  matchStrength: CanonicalIdentityMatchStrength;
  existingCompanyId?: string | null;
  externalId?: string | null;
};

export function buildCanonicalCompanyIdentity(input: {
  name: string;
  website?: string | null;
  domain?: string | null;
  city?: string | null;
  organizationId?: string;
  companyId?: string | null;
  externalId?: string | null;
}): CanonicalCompanyIdentity {
  const normalizedName = normalizeCompanyName(input.name);
  const officialDomain =
    input.domain?.trim().toLowerCase().replace(/^www\./, "")
    ?? resolveOfficialDomain(input.website ?? "")
    ?? extractDomain(input.website);
  const canonicalDomain = officialDomain ? officialDomain.replace(/^www\./, "") : null;
  const normalizedWebsite = normalizeWebsite(input.website);

  let dedupeKey: string;
  let matchStrength: CanonicalIdentityMatchStrength;

  if (input.externalId?.trim()) {
    dedupeKey = `ext::${input.externalId.trim()}`;
    matchStrength = "external_id";
  } else if (canonicalDomain) {
    dedupeKey = `domain::${canonicalDomain}`;
    matchStrength = "domain";
  } else if (input.companyId) {
    dedupeKey = `company::${input.companyId}`;
    matchStrength = "external_id";
  } else {
    const city = input.city?.trim().toLowerCase() ?? "";
    dedupeKey = `name::${normalizedName}::${city}`;
    matchStrength = city ? "name_city" : "weak_name";
  }

  if (input.organizationId) {
    dedupeKey = `org::${input.organizationId}::${dedupeKey}`;
  }

  return {
    canonicalDomain,
    normalizedName,
    normalizedWebsite,
    dedupeKey,
    matchStrength,
    existingCompanyId: input.companyId ?? null,
    externalId: input.externalId ?? null,
  };
}

export function canonicalCandidateDedupeKey(candidate: {
  name: string;
  website?: string | null;
  domain?: string | null;
  city?: string | null;
  externalId?: string;
  normalizedName?: string;
}): string {
  return createCandidateKey({
    website: candidate.website,
    domain: candidate.domain,
    city: candidate.city,
    externalId: candidate.externalId,
    normalizedName: candidate.normalizedName ?? normalizeCompanyName(candidate.name),
  });
}