import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import { DISCOVERY_TYPE_SCORES } from "@/features/company-finder/discovery/discovery-quality.types";
import { vacancyTitleMatchesDesiredRoleList } from "@/features/ai-recruiter/services/desired-role-matching.service";

export type DiscoveryPersistenceContext = {
  locations?: string[];
  sectors?: string[];
  desiredRoles?: string[];
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function locationMatchScore(candidate: QualifiedDiscoveryCandidate, locations: string[]): number {
  if (locations.length === 0) return 0;
  const city = normalize(candidate.candidate.city ?? "");
  const region = normalize(candidate.candidate.region ?? candidate.candidate.province ?? "");
  const hits = locations.filter(
    (loc) => city.includes(normalize(loc)) || region.includes(normalize(loc)),
  );
  return hits.length > 0 ? 400 : city.length === 0 ? 0 : -200;
}

function sectorMatchScore(candidate: QualifiedDiscoveryCandidate, sectors: string[]): number {
  if (sectors.length === 0) return 0;
  const sector = normalize(candidate.candidate.sector ?? "");
  if (!sector) return 0;
  return sectors.some((s) => sector.includes(normalize(s))) ? 300 : -150;
}

function vacancyRoleMatchScore(candidate: QualifiedDiscoveryCandidate, desiredRoles: string[]): number {
  if (desiredRoles.length === 0) return 0;
  const titles = candidate.candidate.vacancyTitles ?? [];
  if (titles.length === 0) return 0;

  const matched = titles.some((title) =>
    vacancyTitleMatchesDesiredRoleList(title, desiredRoles),
  );

  return matched ? 2_500 : titles.length > 0 ? 200 : 0;
}

function concreteVacancyScore(candidate: QualifiedDiscoveryCandidate): number {
  const count = candidate.candidate.vacancyCount ?? candidate.candidate.vacancyTitles?.length ?? 0;
  if (count <= 0) return 0;
  const hasConcreteUrl = Boolean(
    candidate.candidate.vacancyPageUrl?.trim()
    && !/\/vacatures?\/?$/i.test(candidate.candidate.vacancyPageUrl),
  );
  return (hasConcreteUrl ? 800 : 300) + Math.min(count, 5) * 40;
}

/** Higher score = persist first when plan company cap applies. */
export function rankDiscoveryCandidateForPersistence(
  qualified: QualifiedDiscoveryCandidate,
  context?: DiscoveryPersistenceContext,
): number {
  const typeBoost = qualified.saveStatus === "company" ? 1_000 : qualified.saveStatus === "review" ? 500 : 0;
  const typeScore = DISCOVERY_TYPE_SCORES[qualified.companyType] ?? 0;
  const confidence = qualified.companyConfidence * 100 + (qualified.candidate.confidence ?? 0) * 50;
  const homepage = Math.min(qualified.homepageSignalCount, 6) * 25;

  const agencyPenalty = qualified.companyType === "agency" ? -1_500 : 0;
  const directoryPenalty = qualified.companyType === "directory" ? -2_000 : 0;

  const location = locationMatchScore(qualified, context?.locations ?? []);
  const sector = sectorMatchScore(qualified, context?.sectors ?? []);
  const roleVacancy = vacancyRoleMatchScore(qualified, context?.desiredRoles ?? []);
  const vacancy = concreteVacancyScore(qualified);

  return (
    typeBoost
    + typeScore
    + confidence
    + homepage
    + location
    + sector
    + roleVacancy
    + vacancy
    + agencyPenalty
    + directoryPenalty
  );
}