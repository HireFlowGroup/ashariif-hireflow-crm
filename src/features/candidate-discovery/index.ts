export { getCandidateDiscoveryConfig } from "@/features/candidate-discovery/config/candidate-discovery.config";
export {
  CandidateDiscoveryError,
  candidateDiscoveryMessage,
  classifyProviderSearchError,
} from "@/features/candidate-discovery/domain/candidate-discovery.errors";
export type {
  CandidateDiscoveryQueryPlan,
  CandidateDiscoveryRankOutcome,
  CandidateDiscoverySearchOutcome,
  ParsedSerpProfile,
  RankedCandidateProposal,
} from "@/features/candidate-discovery/domain/candidate-discovery.types";
export { buildCandidateDiscoveryQueryPlan } from "@/features/candidate-discovery/services/candidate-discovery-query-builder.service";
export { rankCandidateDiscoveryResults } from "@/features/candidate-discovery/services/candidate-discovery-rank.service";
export {
  createProviderManagerSearchExecutor,
  runCandidateDiscoverySearch,
  type SearchChainExecutor,
} from "@/features/candidate-discovery/services/candidate-discovery-search.service";
export {
  isLinkedInProfileUrl,
  normalizeLinkedInProfileUrl,
} from "@/features/candidate-discovery/services/linkedin-profile-url.validator";
export { parseSerpToCandidateProfile } from "@/features/candidate-discovery/services/serp-to-candidate-profile.parser";