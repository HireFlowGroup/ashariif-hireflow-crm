import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import type { TavilyDiscoveryResult } from "@/features/company-finder/discovery/discovery-quality-gate";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";

export type DiscoveryPlanConstraintStatus = "matched" | "unknown" | "mismatched";

export type DiscoveryPlanConstraintResult = {
  location: DiscoveryPlanConstraintStatus;
  sector: DiscoveryPlanConstraintStatus;
  acceptable: boolean;
  reason: "wrong_location" | "wrong_sector" | "insufficient_location_evidence" | null;
  detail: string;
  evidence: string[];
};

const NL_LOCATIONS = new Set(
  [
    "rotterdam",
    "den haag",
    "'s-gravenhage",
    "the hague",
    "haag",
    "delft",
    "schiedam",
    "dordrecht",
    "leiden",
    "zoetermeer",
  ].map((v) => v.toLowerCase()),
);

const SOFTWARE_HINTS =
  /\b(software|saas|ict|it dienst|tech|digital|ontwikkel|devops|cloud|data platform|applicatie)\b/i;

const NON_SOFTWARE_CONGLOMERATE_HINTS =
  /\b(vdl groep|metaal|automotive|industrie|manufacturing|bouw|logistiek conglomerate|conglomeraat)\b/i;

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function collectText(
  candidate: ExternalCompanyCandidate,
  result: TavilyDiscoveryResult,
): string {
  return [
    candidate.name,
    candidate.city,
    candidate.region,
    candidate.sector,
    candidate.description,
    result.title,
    result.description,
    result.discoveryLocation,
    result.url,
  ]
    .filter(Boolean)
    .join(" ");
}

function evaluateLocation(
  text: string,
  locations: string[],
  candidateCity: string | null,
  discoveryLocation: string | null,
): { status: DiscoveryPlanConstraintStatus; evidence: string[] } {
  if (locations.length === 0) {
    return { status: "matched", evidence: [] };
  }

  const evidence: string[] = [];
  const haystack = normalize(text);
  const targets = locations.map(normalize);

  for (const loc of targets) {
    if (haystack.includes(loc)) evidence.push(`tekst: ${loc}`);
    if (candidateCity && normalize(candidateCity).includes(loc)) evidence.push(`city: ${candidateCity}`);
    if (discoveryLocation && normalize(discoveryLocation).includes(loc)) {
      evidence.push(`discoveryLocation: ${discoveryLocation}`);
    }
  }

  for (const loc of targets) {
    if (loc.includes("haag") && (haystack.includes("den haag") || haystack.includes("gravenhage"))) {
      evidence.push("regio: Den Haag");
    }
    if (loc.includes("rotterdam") && haystack.includes("rotterdam")) {
      evidence.push("regio: Rotterdam");
    }
  }

  if (evidence.length > 0) return { status: "matched", evidence };

  if (candidateCity) {
    const cityNorm = normalize(candidateCity);
    const matchesTarget = targets.some((t) => cityNorm.includes(t) || t.includes(cityNorm));
    if (!matchesTarget) {
      return { status: "mismatched", evidence: [`city veld ${candidateCity} buiten ${locations.join(", ")}`] };
    }
  }

  const otherNlCity = [...NL_LOCATIONS].find(
    (city) => haystack.includes(city) && !targets.some((t) => city.includes(t) || t.includes(city)),
  );
  if (otherNlCity) {
    return { status: "mismatched", evidence: [`andere locatie in bron: ${otherNlCity}`] };
  }

  if (!candidateCity && !discoveryLocation) {
    return { status: "unknown", evidence: ["geen locatie in kandidaat"] };
  }

  return { status: "unknown", evidence: ["locatie niet bevestigd in gevraagde regio"] };
}

function evaluateSector(
  text: string,
  sectors: string[],
  candidateSector: string | null,
): { status: DiscoveryPlanConstraintStatus; evidence: string[] } {
  if (sectors.length === 0) return { status: "matched", evidence: [] };

  const evidence: string[] = [];
  const haystack = normalize(text);
  const targets = sectors.map(normalize);

  for (const sector of targets) {
    if (candidateSector && normalize(candidateSector).includes(sector)) {
      evidence.push(`sector veld: ${candidateSector}`);
    }
    if (haystack.includes(sector)) evidence.push(`tekst: ${sector}`);
    if (sector.includes("software") && SOFTWARE_HINTS.test(text)) {
      evidence.push("software-signaal in bron");
    }
  }

  if (evidence.length > 0) return { status: "matched", evidence };

  if (NON_SOFTWARE_CONGLOMERATE_HINTS.test(text) && targets.some((s) => s.includes("software"))) {
    return { status: "mismatched", evidence: ["conglomeraat/industrie — geen softwarewerkgever"] };
  }

  if (!candidateSector) return { status: "unknown", evidence: ["sector onbekend"] };

  return { status: "mismatched", evidence: [`sector ${candidateSector} past niet bij ${sectors.join(", ")}`] };
}

/** Evidence-based plan constraints before persistence (P0 false-positive guard). */
export function evaluateDiscoveryPlanConstraints(input: {
  candidate: ExternalCompanyCandidate;
  result: TavilyDiscoveryResult;
  criteria: CompanySearchCriteria;
  requireLocationEvidence?: boolean;
}): DiscoveryPlanConstraintResult {
  const locations = input.criteria.locations?.length
    ? input.criteria.locations
    : input.criteria.city
      ? [input.criteria.city]
      : [];

  const sectors = input.criteria.sectors?.length
    ? input.criteria.sectors
    : input.criteria.sector
      ? [input.criteria.sector]
      : [];

  const text = collectText(input.candidate, input.result);
  const location = evaluateLocation(
    text,
    locations,
    input.candidate.city,
    input.result.discoveryLocation ?? null,
  );
  const sector = evaluateSector(text, sectors, input.candidate.sector);

  if (location.status === "mismatched") {
    return {
      location: location.status,
      sector: sector.status,
      acceptable: false,
      reason: "wrong_location",
      detail: `Locatie past niet bij ${locations.join(", ")} (${location.evidence.join("; ")})`,
      evidence: [...location.evidence, ...sector.evidence],
    };
  }

  if (sector.status === "mismatched") {
    return {
      location: location.status,
      sector: sector.status,
      acceptable: false,
      reason: "wrong_sector",
      detail: sector.evidence.join("; ") || "Sector past niet bij plan",
      evidence: [...location.evidence, ...sector.evidence],
    };
  }

  const requireLocation =
    input.requireLocationEvidence ?? (locations.length > 0 && sectors.some((s) => normalize(s).includes("software")));

  if (requireLocation && location.status === "unknown") {
    return {
      location: location.status,
      sector: sector.status,
      acceptable: false,
      reason: "insufficient_location_evidence",
      detail: `Geen controleerbaar locatiebewijs voor ${locations.join(", ")}`,
      evidence: [...location.evidence, ...sector.evidence],
    };
  }

  return {
    location: location.status,
    sector: sector.status,
    acceptable: true,
    reason: null,
    detail: "Planconstraints: acceptabel of onvoldoende tegenbewijs",
    evidence: [...location.evidence, ...sector.evidence],
  };
}