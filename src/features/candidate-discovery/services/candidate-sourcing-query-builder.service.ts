import { getCandidateDiscoveryConfig } from "@/features/candidate-discovery/config/candidate-discovery.config";
import type { CandidateDiscoveryQueryPlan } from "@/features/candidate-discovery/domain/candidate-discovery.types";
import { CandidateDiscoveryError } from "@/features/candidate-discovery/domain/candidate-discovery.errors";
import type { CandidateSourcingSearchCriteria } from "@/features/candidate-discovery/domain/candidate-sourcing-criteria.types";
import { buildCandidateDiscoveryQueryPlan } from "@/features/candidate-discovery/services/candidate-discovery-query-builder.service";
import { expandTitleTermsForSearch } from "@/features/candidate-discovery/services/role-title-synonyms";
import type { Vacancy } from "@/features/vacancies/domain";

function quoteIfNeeded(term: string): string {
  return /\s/.test(term) ? `"${term}"` : term;
}

function tokensFromInstructions(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ+#.\s-]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4)
    .slice(0, 6);
}

function mergeVacancyWithCriteria(vacancy: Vacancy, criteria: CandidateSourcingSearchCriteria): Vacancy {
  return {
    ...vacancy,
    title: criteria.jobTitle?.trim() || vacancy.title,
    location: criteria.location?.trim() || vacancy.location,
    requirements: [
      vacancy.requirements,
      criteria.skills?.length ? `Skills: ${criteria.skills.join(", ")}` : null,
      criteria.industry ? `Sector: ${criteria.industry}` : null,
      criteria.keywords?.length ? criteria.keywords.join(" ") : null,
      criteria.naturalLanguageInstructions,
      criteria.experienceYearsMin ? `Minimaal ${criteria.experienceYearsMin} jaar ervaring` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildCandidateSourcingQueryPlan(input: {
  vacancy: Vacancy;
  criteria: CandidateSourcingSearchCriteria;
}): CandidateDiscoveryQueryPlan {
  const config = getCandidateDiscoveryConfig();
  const site = config.linkedInProfileSiteConstraint;
  const mergedVacancy = mergeVacancyWithCriteria(input.vacancy, input.criteria);
  const basePlan = buildCandidateDiscoveryQueryPlan(mergedVacancy);

  const titles = [
    input.criteria.jobTitle?.trim(),
    ...(input.criteria.additionalJobTitles ?? []),
    mergedVacancy.title,
  ].filter(Boolean) as string[];

  const location =
    input.criteria.location?.trim() || mergedVacancy.location?.trim() || "Nederland";
  const skillTerms = [
    ...(input.criteria.skills ?? []),
    ...basePlan.skillTerms,
    ...tokensFromInstructions(input.criteria.naturalLanguageInstructions),
    ...(input.criteria.keywords ?? []),
  ].slice(0, 8);

  const extraQueries: string[] = [];

  for (const rawTitle of titles) {
    const expanded = expandTitleTermsForSearch(rawTitle);
    for (const titleTerm of expanded.slice(0, 2)) {
      extraQueries.push(`${site} ${quoteIfNeeded(titleTerm)} ${quoteIfNeeded(location)}`);
      if (skillTerms[0]) {
        extraQueries.push(
          `${site} ${quoteIfNeeded(titleTerm)} ${quoteIfNeeded(skillTerms[0])} ${quoteIfNeeded(location)}`,
        );
      }
    }
  }

  if (input.criteria.industry?.trim()) {
    extraQueries.push(
      `${site} ${quoteIfNeeded(titles[0] ?? "recruiter")} ${quoteIfNeeded(input.criteria.industry)} ${quoteIfNeeded(location)}`,
    );
  }

  const queries = [...new Set([...basePlan.queries, ...extraQueries].map((q) => q.replace(/\s+/g, " ").trim()))].slice(
    0,
    config.maxQueries,
  );

  if (queries.length === 0) {
    throw new CandidateDiscoveryError("invalid_vacancy", "Geen zoekopdrachten gegenereerd.");
  }

  return {
    queries,
    vacancyTitle: mergedVacancy.title,
    locationHint: location,
    skillTerms: [...new Set(skillTerms)],
  };
}