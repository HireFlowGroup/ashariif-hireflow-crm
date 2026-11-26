import "server-only";

import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import {
  type DiscoveryPersistenceContext,
  rankDiscoveryCandidateForPersistence,
} from "@/features/ai-recruiter/services/discovery-persistence-priority.service";

/**
 * Server-side ceilings on plan limits (P0 / tenant policy).
 * Parsed or client-submitted values are never allowed to exceed these.
 */
export function clampAiRecruiterSearchPlan(plan: AiRecruiterSearchPlan): AiRecruiterSearchPlan {
  const {
    planLimitMaximumCompanies,
    planLimitMaximumDrafts,
    defaultMaximumCompanies,
    defaultMaximumDrafts,
  } = getAiRecruiterConfig();

  const maxCompanies = Math.min(
    plan.maximum_companies,
    planLimitMaximumCompanies,
    defaultMaximumCompanies,
  );
  const maxDrafts = Math.min(
    plan.maximum_drafts,
    planLimitMaximumDrafts,
    defaultMaximumDrafts,
  );

  return {
    ...plan,
    maximum_companies: Math.max(1, maxCompanies),
    maximum_drafts: Math.max(0, maxDrafts),
  };
}

/** Effective persistence cap for a clamped run plan (server ceilings already applied). */
export function resolveMaximumCompaniesForRun(plan: AiRecruiterSearchPlan): number {
  return clampAiRecruiterSearchPlan(plan).maximum_companies;
}

export function resolveMaximumDraftsForRun(plan: AiRecruiterSearchPlan): number {
  return clampAiRecruiterSearchPlan(plan).maximum_drafts;
}

/**
 * Caps companies selected for Supabase persistence (distinct from raw search hits).
 * Deterministic ordering prevents parallel save races from exceeding the cap.
 */
export function limitQualifiedDiscoveryCandidatesForPersistence(
  candidates: QualifiedDiscoveryCandidate[],
  maximumCompanies: number,
  persistenceContext?: DiscoveryPersistenceContext,
): { toPersist: QualifiedDiscoveryCandidate[]; deferredCount: number } {
  const cap = Math.max(0, maximumCompanies);
  if (candidates.length <= cap) {
    return { toPersist: candidates, deferredCount: 0 };
  }

  const toPersist = [...candidates]
    .sort(
      (a, b) =>
        rankDiscoveryCandidateForPersistence(b, persistenceContext)
        - rankDiscoveryCandidateForPersistence(a, persistenceContext),
    )
    .slice(0, cap);

  return { toPersist, deferredCount: candidates.length - cap };
}