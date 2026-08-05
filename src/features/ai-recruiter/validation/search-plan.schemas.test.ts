import { describe, expect, it } from "vitest";

import {
  aiRecruiterPlanSchema,
  aiRecruiterSearchPlanRawSchema,
  sanitizeAiRecruiterSearchPlan,
} from "@/features/ai-recruiter/validation/search-plan.schemas";

describe("AI Recruiter search plan sanitization", () => {
  it("coerces string numbers and applies defaults", () => {
    const raw = aiRecruiterSearchPlanRawSchema.parse({
      locations: ["Rotterdam", "Den Haag"],
      regions: [],
      sectors: ["software"],
      employee_range: { min: "20", max: "200" },
      desired_roles: ["recruiter", "accountmanager"],
      vacancy_required: false,
      minimum_hiring_score: "40",
      maximum_companies: "25",
      maximum_drafts: "10",
      contact_roles: [],
      outreach_mode: "draft_only",
      approval_mode: "manual",
      exclusions: [],
      uncertainties: [],
      reasoning: "Test",
    });

    const plan = sanitizeAiRecruiterSearchPlan(raw);

    expect(plan.employee_range.min).toBe(20);
    expect(plan.employee_range.max).toBe(200);
    expect(plan.maximum_companies).toBe(25);
    expect(plan.contact_roles.length).toBeGreaterThan(0);
    expect(aiRecruiterPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("defaults maximum_companies and maximum_drafts when null", () => {
    const plan = sanitizeAiRecruiterSearchPlan({
      locations: [],
      regions: [],
      sectors: [],
      employee_range: { min: null, max: null },
      desired_roles: [],
      vacancy_required: false,
      minimum_hiring_score: 40,
      maximum_companies: null,
      maximum_drafts: null,
      contact_roles: ["HR Manager"],
      outreach_mode: "draft_only",
      approval_mode: "manual",
      exclusions: [],
      uncertainties: ["Geen locatie genoemd"],
      reasoning: "Fallback",
    });

    expect(plan.maximum_companies).toBe(25);
    expect(plan.maximum_drafts).toBe(10);
  });

  it("rejects invalid outreach_mode via sanitize fallback", () => {
    const plan = sanitizeAiRecruiterSearchPlan({
      outreach_mode: "auto_send",
      approval_mode: "manual",
      reasoning: "x",
    });

    expect(plan.outreach_mode).toBe("draft_only");
  });
});
