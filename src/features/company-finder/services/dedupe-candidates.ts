import type { ExternalCompanyCandidate } from "@/features/company-finder/domain";
import type { Company } from "@/features/companies/domain";

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(bv|b\.v\.|nv|n\.v\.|holding|group|groep)\b/gi, " ")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function isDuplicateCandidate(
  candidate: ExternalCompanyCandidate,
  existingCompanies: Company[],
): boolean {
  const candidateKey = normalizeCompanyName(candidate.name);
  const candidateCity = candidate.city?.trim().toLowerCase() ?? "";

  return existingCompanies.some((company) => {
    if (normalizeCompanyName(company.name) !== candidateKey) {
      return false;
    }

    const companyCity = company.city?.trim().toLowerCase() ?? "";

    if (!candidateCity || !companyCity) {
      return true;
    }

    return candidateCity === companyCity;
  });
}

export function dedupeCandidates(
  candidates: ExternalCompanyCandidate[],
): ExternalCompanyCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${normalizeCompanyName(candidate.name)}::${candidate.city?.toLowerCase() ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
