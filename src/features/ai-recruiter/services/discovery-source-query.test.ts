import { describe, expect, it } from "vitest";

import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import {
  buildDiscoverySourceQueryLabel,
  DISCOVERY_SOURCE_QUERY_MAX_LENGTH,
} from "@/features/ai-recruiter/services/discovery-source-query";
import { searchPlanToCompanyFinderCriteria } from "@/features/ai-recruiter/services/search-plan-parser.service";
import { createCompanySearchJobSchema } from "@/features/company-finder/validation";

const commercialPilotPlan = {
  locations: ["Rotterdam", "Den Haag", "Utrecht", "Amsterdam"],
  regions: [],
  sectors: [],
  employee_range: { min: null, max: null },
  desired_roles: [
    "Corporate Recruiter",
    "Talent Acquisition Specialist",
    "Recruitment Consultant",
    "Recruiter",
  ],
  vacancy_required: true,
  minimum_hiring_score: 70,
  minimum_opportunity_score: 70,
  maximum_companies: 10,
  maximum_drafts: 5,
  contact_roles: ["HR Manager", "Recruiter", "TA", "HRBP", "Teamlead Recruitment", "Directeur"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: ["sector", "employee_range"],
  reasoning: "plan uit lange opdracht",
} satisfies AiRecruiterSearchPlan;

describe("discovery sourceQuery (Commercial Pilot 001 regression)", () => {
  it("keeps discovery label within schema max while run prompt can be >500 chars", () => {
    const longRunPrompt =
      "Commercial Pilot 001 — Nederlandse werkgevers (geen uitzendbureaus). ".repeat(12)
      + "Zoek actuele vacatures voor Corporate Recruiter, TA, Recruitment Consultant, Recruiter. "
      + "Alleen employer-hosted vacature-URLs. maximum_companies=10, maximum_drafts=5.";

    expect(longRunPrompt.length).toBeGreaterThan(500);

    const label = buildDiscoverySourceQueryLabel(commercialPilotPlan, longRunPrompt);
    expect(label.length).toBeLessThanOrEqual(DISCOVERY_SOURCE_QUERY_MAX_LENGTH);

    const criteria = searchPlanToCompanyFinderCriteria(commercialPilotPlan, longRunPrompt);
    expect(criteria.sourceQuery).toBe(label);
    expect(criteria.discoveryMode).toBe("open");

    const parsed = createCompanySearchJobSchema.parse(criteria);
    expect(parsed.sourceQuery).toBe(label);
  });
});