import { getCandidateDiscoveryConfig } from "@/features/candidate-discovery/config/candidate-discovery.config";
import type {
  CandidateDiscoveryRankOutcome,
  CandidateDiscoverySearchOutcome,
  ParsedSerpProfile,
  RankedCandidateProposal,
} from "@/features/candidate-discovery/domain/candidate-discovery.types";
import { computeCandidateMatch } from "@/features/candidate-matching/services/candidate-matcher.service";
import type { Vacancy } from "@/features/vacancies/domain";
import { parseSerpToCandidateProfile } from "@/features/candidate-discovery/services/serp-to-candidate-profile.parser";
import { assessProfileEvidence } from "@/features/candidate-discovery/services/profile-evidence.service";
import type { CandidateDiscoveryQueryPlan } from "@/features/candidate-discovery/domain/candidate-discovery.types";

function buildMatchRationale(
  profile: ParsedSerpProfile,
  evidence: ReturnType<typeof assessProfileEvidence>,
  match: ReturnType<typeof computeCandidateMatch>,
): string[] {
  const lines: string[] = [];

  lines.push(
    `Score ${match.matchScore}/100 — rol ${match.breakdown.roleFit}/25, skills ${match.breakdown.skillsFit}/30, locatie ${match.breakdown.locationFit}/15, ervaring ${match.breakdown.experienceFit}/15, salaris ${match.breakdown.salaryFit}/15.`,
  );

  for (const signal of evidence.secondarySignals) {
    lines.push(`Bewijs: ${signal}.`);
  }

  if (match.strongPoints.length > 0) {
    lines.push(...match.strongPoints.slice(0, 3).map((p) => `Sterk punt: ${p}`));
  }
  if (match.risks.length > 0) {
    lines.push(...match.risks.slice(0, 2).map((r) => `Let op: ${r}`));
  }
  if (profile.unknownFields.length > 0) {
    lines.push(`Onbekend in bron: ${profile.unknownFields.join(", ")}.`);
  }

  return lines;
}

export type RankDiscoveryInput = {
  vacancy: Vacancy;
  queryPlan: CandidateDiscoveryQueryPlan;
  searchOutcome: CandidateDiscoverySearchOutcome;
  minMatchScore?: number;
  maxCandidates?: number;
};

export function rankCandidateDiscoveryResults(input: RankDiscoveryInput): CandidateDiscoveryRankOutcome {
  const config = getCandidateDiscoveryConfig();
  const minMatchScore = input.minMatchScore ?? config.minMatchScore;
  const maxCandidates = input.maxCandidates ?? config.maxCandidates;

  const seen = new Set<string>();
  let belowMinScoreCount = 0;
  let ineligibleCount = 0;
  let duplicateUrlCount = 0;

  const scored: Array<{
    profile: ParsedSerpProfile;
    match: ReturnType<typeof computeCandidateMatch>;
    rationale: string[];
    sourceQuery: string;
    providerId: string | null;
  }> = [];

  for (const item of input.searchOutcome.items) {
    const profile = parseSerpToCandidateProfile({
      item: { title: item.title, url: item.url, description: item.description },
      vacancySkillTerms: input.queryPlan.skillTerms,
      vacancyLocation: input.queryPlan.locationHint,
    });
    if (!profile) continue;

    if (seen.has(profile.linkedinUrl)) {
      duplicateUrlCount += 1;
      continue;
    }
    seen.add(profile.linkedinUrl);

    const evidence = assessProfileEvidence(input.vacancy, profile);
    if (!evidence.eligibleForRanking) {
      ineligibleCount += 1;
      continue;
    }

    const matchInput = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      candidateCurrentRole: profile.candidateCurrentRole,
      location: profile.location,
      summary: profile.summary,
      skills: profile.skills,
      experienceYears: profile.experienceYears,
      salaryExpectationMin: null,
      salaryExpectationMax: null,
      availability: null,
    };

    const match = computeCandidateMatch(input.vacancy, matchInput);
    if (match.matchScore < minMatchScore) {
      belowMinScoreCount += 1;
      continue;
    }

    const rationale = buildMatchRationale(profile, evidence, match);

    scored.push({
      profile,
      match,
      rationale,
      sourceQuery: item.sourceQuery,
      providerId: item.sourceProvider,
    });
  }

  scored.sort((a, b) => {
    if (b.match.matchScore !== a.match.matchScore) {
      return b.match.matchScore - a.match.matchScore;
    }
    return b.match.breakdown.skillsFit - a.match.breakdown.skillsFit;
  });

  const proposals: RankedCandidateProposal[] = scored.slice(0, maxCandidates).map((row, index) => ({
    rank: index + 1,
    linkedinUrl: row.profile.linkedinUrl,
    profile: row.profile,
    matchInput: {
      firstName: row.profile.firstName,
      lastName: row.profile.lastName,
      candidateCurrentRole: row.profile.candidateCurrentRole,
      location: row.profile.location,
      summary: row.profile.summary,
      skills: row.profile.skills,
      experienceYears: row.profile.experienceYears,
      salaryExpectationMin: null,
      salaryExpectationMax: null,
      availability: null,
    },
    match: row.match,
    matchRationale: row.rationale,
    sourceQuery: row.sourceQuery,
    sourceProvider: row.providerId,
  }));

  return {
    proposals,
    belowMinScoreCount,
    ineligibleCount,
    duplicateUrlCount,
    minMatchScoreUsed: minMatchScore,
  };
}