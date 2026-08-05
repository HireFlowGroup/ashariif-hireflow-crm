import { z } from "zod";

import { finalizeRecruitmentAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-opportunity.helpers";
import {
  INSUFFICIENT_DATA,
  LEGACY_INSUFFICIENT_DATA,
  type RecruitmentOpportunityTier,
} from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";

const tierSchema = z.enum(["warm", "interessant", "lage_kans"]);

export const recruitmentIntelligenceAnalysisSchema = z.object({
  company_summary: z.string().min(1),
  why_agency: z.string().min(1),
  likely_pain_points: z.string().min(1),
  why_hireflow: z.string().min(1),
  hard_to_fill_roles: z.string().min(1),
  urgency_rationale: z.string().min(1),
  opportunity_chance_rationale: z.string().min(1),
  likely_decision_maker: z.string().min(1),
  opening_line: z.string().min(1),
  recommended_cta: z.string().min(1),
  urgency_score: z.number().int().min(0).max(100).nullable(),
  recruitment_opportunity_score: z.number().int().min(0).max(100).nullable(),
  opportunity_tier: tierSchema.nullable(),
});

function normalizeLegacyValue(value: unknown, fallback = INSUFFICIENT_DATA): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const trimmed = value.trim();
  if (trimmed === LEGACY_INSUFFICIENT_DATA) return INSUFFICIENT_DATA;
  return trimmed;
}

function normalizeLegacyAnalysis(raw: Record<string, unknown>): z.infer<typeof recruitmentIntelligenceAnalysisSchema> {
  const recruitment_opportunity_score =
    sanitizeScore(raw.recruitment_opportunity_score)
    ?? sanitizeScore(raw.recruitment_probability);

  return {
    company_summary: normalizeLegacyValue(raw.company_summary),
    why_agency: normalizeLegacyValue(raw.why_agency ?? raw.hiring_challenges),
    likely_pain_points: normalizeLegacyValue(raw.likely_pain_points),
    why_hireflow: normalizeLegacyValue(raw.why_hireflow ?? raw.recommended_approach),
    hard_to_fill_roles: normalizeLegacyValue(raw.hard_to_fill_roles ?? raw.expected_hiring_volume),
    urgency_rationale: normalizeLegacyValue(raw.urgency_rationale ?? raw.why_now),
    opportunity_chance_rationale: normalizeLegacyValue(
      raw.opportunity_chance_rationale ?? raw.recruitment_potential,
    ),
    likely_decision_maker: normalizeLegacyValue(raw.likely_decision_maker),
    opening_line: normalizeLegacyValue(raw.opening_line ?? raw.recommended_subject),
    recommended_cta: normalizeLegacyValue(raw.recommended_cta),
    urgency_score: sanitizeScore(raw.urgency_score),
    recruitment_opportunity_score,
    opportunity_tier: (raw.opportunity_tier as RecruitmentOpportunityTier | null) ?? null,
  };
}

export function emptyRecruitmentIntelligenceAnalysis(): z.infer<typeof recruitmentIntelligenceAnalysisSchema> {
  return finalizeRecruitmentAnalysis({
    company_summary: INSUFFICIENT_DATA,
    why_agency: INSUFFICIENT_DATA,
    likely_pain_points: INSUFFICIENT_DATA,
    why_hireflow: INSUFFICIENT_DATA,
    hard_to_fill_roles: INSUFFICIENT_DATA,
    urgency_rationale: INSUFFICIENT_DATA,
    opportunity_chance_rationale: INSUFFICIENT_DATA,
    likely_decision_maker: INSUFFICIENT_DATA,
    opening_line: INSUFFICIENT_DATA,
    recommended_cta: INSUFFICIENT_DATA,
    urgency_score: null,
    recruitment_opportunity_score: null,
    opportunity_tier: null,
  });
}

export function parseRecruitmentIntelligenceAnalysis(
  value: unknown,
): z.infer<typeof recruitmentIntelligenceAnalysisSchema> {
  if (value && typeof value === "object") {
    const normalized = normalizeLegacyAnalysis(value as Record<string, unknown>);
    const parsed = recruitmentIntelligenceAnalysisSchema.safeParse(finalizeRecruitmentAnalysis(normalized));
    if (parsed.success) return parsed.data;
  }

  return emptyRecruitmentIntelligenceAnalysis();
}

export function sanitizeAnalysisField(value: unknown, fallback = INSUFFICIENT_DATA): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const trimmed = value.trim();
  if (trimmed === LEGACY_INSUFFICIENT_DATA) return INSUFFICIENT_DATA;
  return trimmed;
}

export function sanitizeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, Math.round(num)));
}
