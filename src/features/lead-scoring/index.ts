export * from "@/features/lead-scoring/domain/lead-score.types";
export * from "@/features/lead-scoring/config/lead-scoring.config";
export {
  computeLeadScore,
  leadScoreInputFromCandidate,
} from "@/features/lead-scoring/services/lead-scoring-engine.service";
export { generateScoreExplanation } from "@/features/lead-scoring/services/score-explanation.service";
export { scoreLeadWithExplanation } from "@/features/lead-scoring/services/lead-scoring.service";
