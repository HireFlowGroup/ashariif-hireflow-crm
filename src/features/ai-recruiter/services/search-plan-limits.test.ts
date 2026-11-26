import { afterEach, describe, expect, it, vi } from "vitest";

import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { clampAiRecruiterSearchPlan } from "@/features/ai-recruiter/services/search-plan-limits.service";

function basePlan(overrides: { maximum_companies?: number; maximum_drafts?: number }) {
  return aiRecruiterSearchPlanSchema.parse({
    locations: ["Rotterdam"],
    regions: [],
    sectors: ["software"],
    employee_range: { min: 20, max: 200 },
    desired_roles: ["Recruiter"],
    vacancy_required: true,
    minimum_hiring_score: 70,
    minimum_opportunity_score: 70,
    maximum_companies: overrides.maximum_companies ?? 25,
    maximum_drafts: overrides.maximum_drafts ?? 10,
    contact_roles: ["HR Manager"],
    outreach_mode: "draft_only",
    approval_mode: "manual",
    exclusions: [],
    uncertainties: [],
    reasoning: "test",
  });
}

describe("clampAiRecruiterSearchPlan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("clamps companies and drafts to configured ceilings", () => {
    vi.stubEnv("AI_RECRUITER_DEFAULT_MAX_COMPANIES", "3");
    vi.stubEnv("AI_RECRUITER_DEFAULT_MAX_DRAFTS", "3");
    vi.stubEnv("AI_RECRUITER_PLAN_LIMIT_MAXIMUM_COMPANIES", "3");
    vi.stubEnv("AI_RECRUITER_PLAN_LIMIT_MAXIMUM_DRAFTS", "3");

    const plan = clampAiRecruiterSearchPlan(basePlan({ maximum_companies: 100, maximum_drafts: 50 }));

    expect(plan.maximum_companies).toBe(3);
    expect(plan.maximum_drafts).toBe(3);
  });

  it("applies ceilings to legacy stored plans before resume", () => {
    vi.stubEnv("AI_RECRUITER_DEFAULT_MAX_COMPANIES", "3");
    vi.stubEnv("AI_RECRUITER_DEFAULT_MAX_DRAFTS", "3");

    const legacy = basePlan({ maximum_companies: 3, maximum_drafts: 10 });
    const plan = clampAiRecruiterSearchPlan(legacy);

    expect(plan.maximum_companies).toBe(3);
    expect(plan.maximum_drafts).toBe(3);
  });
});