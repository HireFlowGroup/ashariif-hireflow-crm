import "server-only";

import type { CompanyFinderCriteria } from "@/features/company-finder/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";
import {
  AI_RECRUITER_SEARCH_PLAN_JSON_SCHEMA,
  AI_RECRUITER_SEARCH_PLAN_SCHEMA_NAME,
} from "@/features/ai-recruiter/services/extract-search-plan-json-schema";
import {
  aiRecruiterSearchPlanRawSchema,
  sanitizeAiRecruiterSearchPlan,
} from "@/features/ai-recruiter/validation/search-plan.schemas";
import { DEFAULT_MODEL } from "@/lib/ai/config";
import { getOpenAIClient } from "@/lib/ai/client";
import { isOpenAIConfigured } from "@/platform/config/env";
import type { ZodIssue } from "zod";

export class SearchPlanParserError extends Error {
  readonly code: "OPENAI_NOT_CONFIGURED" | "INVALID_OUTPUT";
  readonly issues?: ZodIssue[];

  constructor(
    message: string,
    code: "OPENAI_NOT_CONFIGURED" | "INVALID_OUTPUT" = "INVALID_OUTPUT",
    issues?: ZodIssue[],
  ) {
    super(message);
    this.name = "SearchPlanParserError";
    this.code = code;
    this.issues = issues;
  }
}

const SYSTEM_PROMPT = `Je vertaalt Nederlandse commerciële recruitment-opdrachten naar een strikt JSON zoekplan voor HireFlow AI Recruiter.

CONTEXT — HEAD OF RECRUITMENT INTELLIGENCE:
Doel is NIET bedrijven zoeken omwille van bedrijven.
Doel is RECRUITMENTOPDRACHTEN / hiring opportunities vinden — bedrijven waar waarschijnlijk een externe recruitmentopdracht ligt.

Zoek naar signalen van:
1. Meerdere open vacatures / hiringdruk
2. Moeilijk te vervullen rollen
3. Groeiende teams zonder zichtbare interne recruiter
4. Lang openstaande vacatures
5. Schaalbare bedrijven (ca. 20–500 medewerkers) met actieve hiring

STRICTE REGELS:
1. Extraheer ALLEEN wat expliciet in de prompt staat of daar direct uit volgt.
2. Verzin GEEN locaties, sectoren, aantallen of functies die niet genoemd zijn.
3. Zet ontbrekende waarden op null/leeg en vermeld die in uncertainties[].
4. maximum_companies: expliciet genoemd aantal; anders 25.
5. maximum_drafts: expliciet genoemd (bijv. "beste 10"); anders 10.
6. desired_roles: functies/rollen waar hiring opportunities op wijzen (niet functies die wij plaatsen).
7. vacancy_required: true als open vacatures expliciet vereist zijn voor prospecting.
8. outreach_mode: altijd "draft_only" tenzij automatisch verzenden gevraagd.
9. approval_mode: altijd "manual" tenzij expliciet anders.
10. minimum_opportunity_score: default 70 — alleen opportunities boven 70 gaan naar outreach.
11. minimum_hiring_score: default 70.
12. contact_roles: prioriteit HR Manager > Recruiter > TA > HRBP > Teamlead Recruitment > Directeur; fallback mailbox recruitment@ > hr@ > jobs@ > info@.

Vul ALLE schema-velden in.`;

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
    minimum_hiring_score: 70,
    minimum_opportunity_score: 70,
    maximum_companies: maxCompanies,
    maximum_drafts: maxDrafts,
    contact_roles: [
      "HR Manager",
      "Recruiter",
      "Talent Acquisition",
      "HR Business Partner",
      "Teamlead Recruitment",
      "Directeur",
    ],
    outreach_mode: "draft_only",
    approval_mode: "manual",
    exclusions: [],
    uncertainties: ["OpenAI niet geconfigureerd — beperkte parse, controleer plan handmatig."],
    reasoning: "Fallback parse op basis van prompt — controleer alle velden.",
  });
}

function parseStructuredPlanContent(rawContent: string | null | undefined, prompt: string): AiRecruiterSearchPlan {
  if (!rawContent?.trim()) {
    throw new SearchPlanParserError("Leeg AI-antwoord.");
  }

  // TEMP debug logging — remove after schema stabilizes
  console.log("[AI Recruiter] parse-plan prompt:", prompt);
  console.log("[AI Recruiter] rawResponse:", rawContent);

  let json: unknown;

  try {
    json = JSON.parse(rawContent);
  } catch (error) {
    console.log("[AI Recruiter] parsedResponse: JSON.parse failed", error);
    throw new SearchPlanParserError("AI-antwoord kon niet worden gelezen als JSON.");
  }

  console.log("[AI Recruiter] parsedResponse:", json);

  const rawParsed = aiRecruiterSearchPlanRawSchema.safeParse(json);

  if (!rawParsed.success) {
    console.log("[AI Recruiter] schemaErrors (raw):", rawParsed.error.issues);
    console.log("[AI Recruiter] missingFields:", rawParsed.error.issues.map((i) => i.path.join(".")));
    throw new SearchPlanParserError(
      "AI-antwoord voldeed niet aan het schema.",
      "INVALID_OUTPUT",
      rawParsed.error.issues,
    );
  }

  try {
    const sanitized = sanitizeAiRecruiterSearchPlan(rawParsed.data);
    const validated = aiRecruiterSearchPlanSchema.safeParse(sanitized);

    if (!validated.success) {
      console.log("[AI Recruiter] schemaErrors (final):", validated.error.issues);
      console.log("[AI Recruiter] missingFields:", validated.error.issues.map((i) => i.path.join(".")));
      throw new SearchPlanParserError(
        "Gevalideerd plan voldeed niet aan het domeinschema.",
        "INVALID_OUTPUT",
        validated.error.issues,
      );
    }

    return validated.data;
  } catch (error) {
    if (error instanceof SearchPlanParserError) throw error;
    throw new SearchPlanParserError(
      error instanceof Error ? error.message : "Plan sanitization mislukt.",
    );
  }
}

export async function parseAiRecruiterSearchPlan(prompt: string): Promise<AiRecruiterSearchPlan> {
  if (!isOpenAIConfigured()) {
    return buildFallbackPlan(prompt);
  }

  const trimmedPrompt = prompt.trim();

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: trimmedPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: AI_RECRUITER_SEARCH_PLAN_SCHEMA_NAME,
          strict: true,
          schema: AI_RECRUITER_SEARCH_PLAN_JSON_SCHEMA,
        },
      },
      max_tokens: 1200,
    });

    const rawResponse = response.choices[0]?.message?.content;

    console.log("[AI Recruiter] openai", {
      id: response.id,
      model: response.model,
      finishReason: response.choices[0]?.finish_reason,
      usage: response.usage,
    });

    return parseStructuredPlanContent(rawResponse, trimmedPrompt);
  } catch (error) {
    if (error instanceof SearchPlanParserError) throw error;

    console.error("[AI Recruiter] parse-plan OpenAI/unexpected error", error);
    return buildFallbackPlan(trimmedPrompt);
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
    locations: plan.locations,
    regions: plan.regions,
    sectors: plan.sectors,
    desiredRoles: plan.desired_roles,
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
