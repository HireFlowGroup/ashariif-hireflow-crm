import { getCandidateDiscoveryConfig } from "@/features/candidate-discovery/config/candidate-discovery.config";
import type { CandidateDiscoveryQueryPlan } from "@/features/candidate-discovery/domain/candidate-discovery.types";
import { CandidateDiscoveryError } from "@/features/candidate-discovery/domain/candidate-discovery.errors";
import type { Vacancy } from "@/features/vacancies/domain";
import { expandTitleTermsForSearch } from "@/features/candidate-discovery/services/role-title-synonyms";

const SKILL_STOP = new Set([
  "jaar",
  "years",
  "ervaring",
  "experience",
  "minimaal",
  "minimum",
  "must",
  "have",
  "with",
  "and",
  "the",
]);

function extractSkillTerms(vacancy: Vacancy): string[] {
  const blob = [vacancy.requirements, vacancy.description, vacancy.title].filter(Boolean).join(" ");
  const tokens = blob
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ+#.\s-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !SKILL_STOP.has(t));

  const phrases: string[] = [];
  const techPattern =
    /\b(?:typescript|javascript|python|java|react|node\.?js|kubernetes|docker|aws|azure|sap|sql|postgres|mongodb|scrum|agile)\b/gi;
  for (const match of blob.matchAll(techPattern)) {
    if (match[0]) phrases.push(match[0]);
  }

  const unique = new Set<string>([...phrases, ...tokens.slice(0, 12)]);
  return [...unique].slice(0, 6);
}

function quoteIfNeeded(term: string): string {
  return /\s/.test(term) ? `"${term}"` : term;
}

export function buildCandidateDiscoveryQueryPlan(vacancy: Vacancy): CandidateDiscoveryQueryPlan {
  const title = vacancy.title?.trim();
  if (!title || title.length < 2) {
    throw new CandidateDiscoveryError("invalid_vacancy", "Vacaturetitel ontbreekt.");
  }

  const config = getCandidateDiscoveryConfig();
  const location = vacancy.location?.trim() || null;
  const skillTerms = extractSkillTerms(vacancy);
  const titleTerms = expandTitleTermsForSearch(title);
  const primaryTitle = quoteIfNeeded(title);
  const site = config.linkedInProfileSiteConstraint;

  const queries: string[] = [];

  // Query 1: volledige titel + locatie
  if (location) {
    queries.push(`${site} ${primaryTitle} ${quoteIfNeeded(location)}`);
  } else {
    queries.push(`${site} ${primaryTitle} Nederland`);
  }

  // Query 2: top skill + titelfragment + locatie
  if (skillTerms.length > 0) {
    const skill = quoteIfNeeded(skillTerms[0]!);
    const fragment = titleTerms[0] ? quoteIfNeeded(titleTerms[0]) : primaryTitle;
    queries.push(`${site} ${skill} ${fragment} ${location ? quoteIfNeeded(location) : "Nederland"}`);
  }

  // Query 3: synoniemen/varianten titel + locatie
  const altTitle = titleTerms.find((t) => !title.toLowerCase().includes(t)) ?? titleTerms[1];
  if (altTitle) {
    queries.push(
      `${site} ${quoteIfNeeded(altTitle)} ${location ? quoteIfNeeded(location) : "Nederland"} professional`,
    );
  } else if (skillTerms.length > 1) {
    queries.push(
      `${site} ${quoteIfNeeded(skillTerms[1]!)} ${primaryTitle} ${location ? quoteIfNeeded(location) : ""}`.trim(),
    );
  }

  const uniqueQueries = [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()))].slice(
    0,
    config.maxQueries,
  );

  if (uniqueQueries.length === 0) {
    throw new CandidateDiscoveryError("invalid_vacancy", "Geen zoekopdrachten gegenereerd.");
  }

  return {
    queries: uniqueQueries,
    vacancyTitle: title,
    locationHint: location,
    skillTerms,
  };
}