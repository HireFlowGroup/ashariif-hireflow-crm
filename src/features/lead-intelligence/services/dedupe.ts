import type { Company, CreateCompanyInput } from "@/features/companies/domain";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import {
  createCandidateKey,
  extractDomain,
  fuzzyNameSimilarity,
  normalizeCompanyName,
  normalizeWebsite,
} from "@/features/lead-intelligence/services/normalize";

export type DedupeMatchReason =
  | "exact_domain"
  | "normalized_website"
  | "name_and_city"
  | "external_id"
  | "fuzzy_name";

export type DedupeResult = {
  isDuplicate: boolean;
  reason?: DedupeMatchReason;
  matchedCompanyId?: string;
};

export function dedupeCandidates(
  candidates: ExternalCompanyCandidate[],
): ExternalCompanyCandidate[] {
  const seen = new Map<string, ExternalCompanyCandidate>();

  for (const candidate of candidates) {
    const key = createCandidateKey(candidate);
    const existing = seen.get(key);

    if (!existing || candidate.confidence > existing.confidence) {
      seen.set(key, candidate);
    }
  }

  return [...seen.values()];
}

export function matchAgainstExisting(
  candidate: ExternalCompanyCandidate,
  existingCompanies: Company[],
): DedupeResult {
  const candidateDomain =
    candidate.domain ?? extractDomain(candidate.website);
  const candidateWebsite = normalizeWebsite(candidate.website);

  for (const company of existingCompanies) {
    const companyDomain = extractDomain(company.website);

    if (candidateDomain && companyDomain && candidateDomain === companyDomain) {
      return { isDuplicate: true, reason: "exact_domain", matchedCompanyId: company.id as string };
    }

    const companyWebsite = normalizeWebsite(company.website);

    if (
      candidateWebsite &&
      companyWebsite &&
      candidateWebsite === companyWebsite
    ) {
      return {
        isDuplicate: true,
        reason: "normalized_website",
        matchedCompanyId: company.id as string,
      };
    }

    if (
      normalizeCompanyName(candidate.name) === normalizeCompanyName(company.name)
    ) {
      const candidateCity = candidate.city?.trim().toLowerCase() ?? "";
      const companyCity = company.city?.trim().toLowerCase() ?? "";

      if (!candidateCity || !companyCity || candidateCity === companyCity) {
        return {
          isDuplicate: true,
          reason: "name_and_city",
          matchedCompanyId: company.id as string,
        };
      }
    }

    const similarity = fuzzyNameSimilarity(candidate.name, company.name);

    if (similarity >= 0.85) {
      return { isDuplicate: true, reason: "fuzzy_name", matchedCompanyId: company.id as string };
    }
  }

  return { isDuplicate: false };
}

/** @deprecated Use mergeLeadFields from company.mapper instead */
export function mergeCandidateIntoCompany(
  existing: Company,
  candidate: ExternalCompanyCandidate,
): Partial<CreateCompanyInput> {
  const updates: Partial<CreateCompanyInput> = {};

  if (!existing.website && candidate.website) updates.website = candidate.website;
  if (!existing.city && candidate.city) updates.city = candidate.city;
  if (!existing.sector && candidate.sector) updates.sector = candidate.sector;

  return updates;
}

export function isExcludedCandidate(
  candidate: ExternalCompanyCandidate,
  excludedNames: string[] = [],
  excludedSectors: string[] = [],
): boolean {
  const normalizedName = normalizeCompanyName(candidate.name);

  for (const excluded of excludedNames) {
    if (normalizedName.includes(normalizeCompanyName(excluded))) {
      return true;
    }
  }

  if (candidate.sector) {
    const sectorLower = candidate.sector.toLowerCase();

    for (const excluded of excludedSectors) {
      if (sectorLower.includes(excluded.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}
