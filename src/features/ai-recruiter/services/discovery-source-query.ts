import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { extractTargetedEmployerConstraints } from "@/features/ai-recruiter/services/targeted-employer-constraint.service";

/** Audit label on company search jobs — must match `finder.schemas` `sourceQuery` max. */
export const DISCOVERY_SOURCE_QUERY_MAX_LENGTH = 500;

/**
 * Compact discovery label for company_search_jobs.criteria.sourceQuery.
 * Full run prompts live on ai_recruiter_runs.prompt; targeting still parses the full prompt.
 */
export function buildDiscoverySourceQueryLabel(
  plan: AiRecruiterSearchPlan,
  runPrompt: string,
): string {
  const targeted = extractTargetedEmployerConstraints(runPrompt);

  const locationPart =
    plan.locations.length > 0
      ? plan.locations.join(", ")
      : plan.regions.length > 0
        ? plan.regions.join(", ")
        : "Nederland";

  const rolePart = plan.desired_roles.join("; ");
  const sectorPart = plan.sectors.join(", ");

  let label: string;

  if (targeted.mode === "targeted" && (targeted.employerNames[0] || targeted.employerDomains[0])) {
    const employer = targeted.employerNames[0] ?? targeted.employerDomains[0] ?? "doelwerkgever";
    const domain = targeted.employerDomains[0];
    label = domain
      ? `Target: ${employer} (${domain}) | ${rolePart || "vacatures"}`
      : `Target: ${employer} | ${rolePart || "vacatures"}`;
  } else {
    const parts = ["AI Recruiter", locationPart, rolePart, sectorPart].filter(Boolean);
    label = parts.join(" | ");
  }

  const trimmed = label.trim();
  if (trimmed.length <= DISCOVERY_SOURCE_QUERY_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, DISCOVERY_SOURCE_QUERY_MAX_LENGTH - 1)}…`;
}