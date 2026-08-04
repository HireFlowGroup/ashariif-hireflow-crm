import "server-only";

import type { CompanyFinderCriteria } from "@/features/company-finder/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import { DEFAULT_MODEL } from "@/lib/ai/config";
import { getOpenAIClient } from "@/lib/ai/client";
import { isOpenAIConfigured } from "@/platform/config/env";

export class SearchPlanParserError extends Error {
  constructor(
    message: string,
    readonly code: "OPENAI_NOT_CONFIGURED" | "INVALID_OUTPUT" = "INVALID_OUTPUT",
  ) {
    super(message);
    this.name = "SearchPlanParserError";
  }
}

const SYSTEM_PROMPT = `Je vertaalt Nederlandse recruitment-zoekopdrachten naar een strikt JSON zoekplan voor HireFlow AI Recruiter.

STRICTE REGELS:
1. Extraheer ALLEEN wat expliciet in de prompt staat of daar direct uit volgt.
2. Verzin GEEN locaties, sectoren, aantallen of functies die niet genoemd zijn.
3. Zet ontbrekende of onduidelijke velden op null/leeg en vermeld die in uncertainties[].
4. maximum_companies: gebruik expliciet genoemd aantal, anders null → default 25.
5. maximum_drafts: gebruik expliciet genoemd aantal (bijv. "beste 10"), anders null → default 10.
6. employee_range: alleen invullen als medewerkersaantal genoemd is.
7. desired_roles: vacaturefuncties die gezocht worden (recruiters, planners, etc.).
8. vacancy_required: true als vacatures expliciet vereist zijn.
9. outreach_mode: altijd "draft_only" tenzij expliciet automatisch verzenden gevraagd.
10. approval_mode: altijd "manual" tenzij expliciet anders.
11. exclusions: bedrijven/sectoren die uitgesloten moeten worden.

Antwoord uitsluitend als JSON volgens het schema.`;

function buildFallbackPlan(prompt: string): AiRecruiterSearchPlan {
  const numbers = prompt.match(/\b(\d{1,3})\b/g)?.map(Number) ?? [];
  const maxCompanies = numbers.find((n) => n >= 5 && n <= 100) ?? 25;
  const maxDrafts = numbers.filter((n) => n >= 1 && n <= 50).slice(-1)[0] ?? 10;

  return aiRecruiterSearchPlanSchema.parse({
    locations: [],
    regions: [],
    sectors: [],
    employee_range: { min: null, max: null },
    desired_roles: [],
    vacancy_required: /vacature|vacancies|jobs/i.test(prompt),
    minimum_hiring_score: 40,
    maximum_companies: maxCompanies,
    maximum_drafts: maxDrafts,
    contact_roles: [
      "Recruitment Manager",
      "Talent Acquisition",
      "HR Manager",
      "HR Business Partner",
      "Directeur",
    ],
    outreach_mode: "draft_only",
    approval_mode: "manual",
    exclusions: [],
    uncertainties: ["OpenAI niet geconfigureerd — beperkte parse, controleer plan handmatig."],
    reasoning: "Fallback parse op basis van prompt — controleer alle velden.",
  });
}

export async function parseAiRecruiterSearchPlan(prompt: string): Promise<AiRecruiterSearchPlan> {
  if (!isOpenAIConfigured()) {
    return buildFallbackPlan(prompt);
  }

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Prompt:\n${prompt}\n\nSchema velden: locations[], regions[], sectors[], employee_range{min,max}, desired_roles[], vacancy_required, minimum_hiring_score, maximum_companies, maximum_drafts, contact_roles[], outreach_mode, approval_mode, exclusions[], uncertainties[], reasoning`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new SearchPlanParserError("Leeg AI-antwoord.");

    const parsed = aiRecruiterSearchPlanSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      throw new SearchPlanParserError("AI-antwoord voldeed niet aan het schema.");
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof SearchPlanParserError) throw error;
    return buildFallbackPlan(prompt);
  }
}

export function searchPlanToCompanyFinderCriteria(
  plan: AiRecruiterSearchPlan,
  sourceQuery: string,
): CompanyFinderCriteria {
  const city = plan.locations[0] ?? undefined;
  const region = plan.regions[0] ?? undefined;
  const sector = plan.sectors[0] ?? undefined;

  return {
    city,
    region,
    sector,
    keywords: plan.desired_roles.length ? plan.desired_roles.join(", ") : undefined,
    employeeCountMin: plan.employee_range.min ?? undefined,
    employeeCountMax: plan.employee_range.max ?? undefined,
    vacancyTitles: plan.desired_roles.length ? plan.desired_roles : undefined,
    searchVacancies: plan.vacancy_required || plan.desired_roles.length > 0,
    maxResults: plan.maximum_companies,
    excludedNames: plan.exclusions,
    sourceQuery,
    fastMode: true,
  };
}
