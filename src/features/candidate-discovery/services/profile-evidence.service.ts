import type {
  ParsedSerpProfile,
  ProfileEvidenceAssessment,
} from "@/features/candidate-discovery/domain/candidate-discovery.types";
import type { Vacancy } from "@/features/vacancies/domain";
import { roleSynonymsMatchingText } from "@/features/candidate-discovery/services/role-title-synonyms";

const STOP = new Set(["de", "het", "een", "voor", "met", "van", "and", "the", "voor", "bij"]);

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ+#.\s-]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function textHasToken(blob: string, token: string): boolean {
  if (token.length < 3) return false;
  return blob.toLowerCase().includes(token.toLowerCase());
}

/**
 * Geen ranking op alléén functietitel: secundair bewijs verplicht
 * (skill, locatie, synoniem rol, of expliciete ervaring in SERP).
 */
export function assessProfileEvidence(vacancy: Vacancy, profile: ParsedSerpProfile): ProfileEvidenceAssessment {
  const roleBlob = `${profile.serpTitle} ${profile.candidateCurrentRole ?? ""}`;
  const secondaryBlob = `${profile.serpSnippet} ${profile.candidateCurrentRole ?? ""}`.trim();
  const vacancyTokens = titleTokens(vacancy.title);

  const roleHits = vacancyTokens.filter((token) => textHasToken(roleBlob, token));
  const hasRoleSignal =
    roleHits.length > 0
    || (profile.candidateCurrentRole != null
      && vacancyTokens.some((t) => profile.candidateCurrentRole!.toLowerCase().includes(t)));

  const secondarySignals: string[] = [];

  if (profile.skills.length > 0) {
    secondarySignals.push(`vaardigheid in zoekresultaat: ${profile.skills.join(", ")}`);
  }

  if (profile.location && vacancy.location) {
    const vl = vacancy.location.toLowerCase();
    const pl = profile.location.toLowerCase();
    if (pl.includes(vl) || vl.includes(pl)) {
      secondarySignals.push(`locatie in zoekresultaat: ${profile.location}`);
    }
  }

  if (profile.experienceYears != null) {
    secondarySignals.push(`ervaring vermeld in snippet: ${profile.experienceYears} jaar`);
  }

  const synonymHits = roleSynonymsMatchingText(secondaryBlob, vacancy.title);
  secondarySignals.push(...synonymHits);

  const hasSecondarySignal = secondarySignals.length > 0;

  if (!hasRoleSignal) {
    return {
      eligibleForRanking: false,
      hasRoleSignal: false,
      hasSecondarySignal,
      secondarySignals,
      rejectionReason: "Geen functiegerelateerd signaal in zoekresultaat.",
    };
  }

  if (!hasSecondarySignal) {
    return {
      eligibleForRanking: false,
      hasRoleSignal: true,
      hasSecondarySignal: false,
      secondarySignals,
      rejectionReason:
        "Onvoldoende secundair bewijs: minimaal vaardigheid, locatie, synoniem rol of ervaring in SERP vereist.",
    };
  }

  return {
    eligibleForRanking: true,
    hasRoleSignal,
    hasSecondarySignal,
    secondarySignals,
    rejectionReason: null,
  };
}