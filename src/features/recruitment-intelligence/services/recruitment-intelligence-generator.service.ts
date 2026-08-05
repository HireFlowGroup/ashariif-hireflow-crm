import {
  emptyRecruitmentIntelligenceAnalysis,
  parseRecruitmentIntelligenceAnalysis,
  sanitizeAnalysisField,
  sanitizeScore,
} from "@/features/recruitment-intelligence/domain/recruitment-intelligence.schema";
import { finalizeRecruitmentAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-opportunity.helpers";
import type {
  RecruitmentIntelligenceAnalysis,
  RecruitmentIntelligenceInput,
} from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { INSUFFICIENT_DATA } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { buildRecruitmentIntelligencePayload } from "@/features/recruitment-intelligence/services/build-recruitment-intelligence-context";
import {
  RECRUITMENT_INTELLIGENCE_JSON_SCHEMA,
  RECRUITMENT_INTELLIGENCE_SCHEMA_NAME,
} from "@/features/recruitment-intelligence/services/recruitment-intelligence-json-schema";
import { getOpenAIClient } from "@/lib/ai/client";
import { isOpenAIConfiguredForActiveOrg } from "@/lib/ai/client";

const ANALYSIS_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `Je bent HireFlow Recruitment Intelligence Engine — Head of Recruitment Intelligence.

DOEL: per bedrijf bepalen of er een recruitmentopdracht-kans is voor HireFlow (AI Business Development platform).

STRICTE REGELS — NOOIT GOKKEN:
- Gebruik UITSLUITEND feiten uit de context (bedrijf, website, vacatures, hiring signals, contactpersonen).
- Verzin NOOIT namen, vacatures, cijfers, contacten, groei, omzet of markttrends die niet in de context staan.
- Als een veld niet uit de context afleidbaar is: schrijf exact "Onvoldoende informatie." (stringvelden) of gebruik null (scores).
- urgency_score en recruitment_opportunity_score: integer 0-100 ALLEEN als voldoende feiten; anders null.
- recruitment_opportunity_score = Recruitment Opportunity Score (kans op een recruitmentopdracht).
- opportunity_tier: "warm" (score >=70), "interessant" (score >=40), "lage_kans" (score <40), null als score null.
- likely_decision_maker: ALLEEN contacten uit de context noemen met functie.
- hard_to_fill_roles: baseer op vacaturetitels of signalen; anders "Onvoldoende informatie."
- opening_line: één zin, concreet, gebaseerd op feiten.
- recommended_cta: één korte vraag, geen marketingtaal.
- Schrijf in het Nederlands, concreet en professioneel.

Deze analyse is de enige bron voor scoring, mail, opvolging, dashboard en prioritering.`;

export type GeneratedRecruitmentIntelligence = {
  analysis: RecruitmentIntelligenceAnalysis;
  model: string | null;
};

function hasMinimalData(input: RecruitmentIntelligenceInput): boolean {
  return (
    Boolean(input.companyName.trim())
    && (input.vacancies.length > 0 || input.signals.length > 0 || input.contacts.length > 0 || Boolean(input.website))
  );
}

export function buildFallbackRecruitmentIntelligence(
  input: RecruitmentIntelligenceInput,
): RecruitmentIntelligenceAnalysis {
  if (!hasMinimalData(input)) {
    return emptyRecruitmentIntelligenceAnalysis();
  }

  const openVacancies = input.vacancies.filter((v) => v.status === "open" || v.status === "active");
  const vacancyCount = openVacancies.length;
  const vacancyTitles = openVacancies.map((v) => v.title).slice(0, 5);
  const hrContacts = input.contacts.filter((c) =>
    /hr|recruit|talent|people|human resources|directeur|manager/i.test(c.jobTitle ?? ""),
  );
  const topSignal = input.signals[0];

  const company_summary = [
    input.companyName,
    input.sector ? `sector ${input.sector}` : null,
    input.city ? `gevestigd in ${input.city}` : null,
    input.website ? `website ${input.website}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  const why_agency =
    vacancyCount >= 2
      ? `${vacancyCount} open vacatures — parallelle hiring vraagt waarschijnlijk externe recruitmentcapaciteit.`
      : vacancyCount === 1
        ? "Eén open vacature — zichtbare hiringbehoefte die ondersteuning kan vereisen."
        : topSignal?.description ?? INSUFFICIENT_DATA;

  const likely_pain_points =
    vacancyCount > 0 && hrContacts.length === 0
      ? "Actieve vacatures zonder zichtbare HR/recruitment-contactpersoon in de data."
      : topSignal?.description ?? INSUFFICIENT_DATA;

  const urgency_rationale =
    topSignal?.description
      ?? (vacancyCount > 0 ? `${vacancyCount} open vacature(s) gedetecteerd.` : INSUFFICIENT_DATA);

  const urgency_score =
    vacancyCount >= 3 ? 80 : vacancyCount === 2 ? 65 : vacancyCount === 1 ? 45 : topSignal ? 40 : null;

  const recruitment_opportunity_score =
    vacancyCount >= 2 ? 60 : vacancyCount === 1 ? 35 : topSignal ? 25 : null;

  const hard_to_fill_roles =
    vacancyTitles.length > 0 ? vacancyTitles.join(", ") : INSUFFICIENT_DATA;

  const likely_decision_maker =
    hrContacts[0]
      ? `${hrContacts[0].name}${hrContacts[0].jobTitle ? ` (${hrContacts[0].jobTitle})` : ""}`
      : input.contacts[0]
        ? `${input.contacts[0].name}${input.contacts[0].jobTitle ? ` (${input.contacts[0].jobTitle})` : ""}`
        : INSUFFICIENT_DATA;

  const opportunity_chance_rationale =
    recruitment_opportunity_score !== null
      ? `Op basis van ${vacancyCount} vacature(s) en ${input.signals.length} hiring signal(s).`
      : INSUFFICIENT_DATA;

  return finalizeRecruitmentAnalysis({
    company_summary: company_summary || INSUFFICIENT_DATA,
    why_agency,
    likely_pain_points,
    why_hireflow:
      vacancyCount > 0
        ? "HireFlow kan flexibel opschalen bij hiringpieken — zonder vaste FTE."
        : INSUFFICIENT_DATA,
    hard_to_fill_roles,
    urgency_rationale,
    opportunity_chance_rationale,
    likely_decision_maker,
    opening_line:
      vacancyCount > 0
        ? `Ik zag dat ${input.companyName} momenteel ${vacancyCount} open vacature${vacancyCount === 1 ? "" : "s"} heeft.`
        : INSUFFICIENT_DATA,
    recommended_cta: "Zou een kort kennismakingsgesprek van 15 minuten volgende week schikken?",
    urgency_score,
    recruitment_opportunity_score,
    opportunity_tier: null,
  });
}

function mapRawAnalysis(raw: Record<string, unknown>): RecruitmentIntelligenceAnalysis {
  const analysis = parseRecruitmentIntelligenceAnalysis({
    company_summary: sanitizeAnalysisField(raw.company_summary),
    why_agency: sanitizeAnalysisField(raw.why_agency),
    likely_pain_points: sanitizeAnalysisField(raw.likely_pain_points),
    why_hireflow: sanitizeAnalysisField(raw.why_hireflow),
    hard_to_fill_roles: sanitizeAnalysisField(raw.hard_to_fill_roles),
    urgency_rationale: sanitizeAnalysisField(raw.urgency_rationale),
    opportunity_chance_rationale: sanitizeAnalysisField(raw.opportunity_chance_rationale),
    likely_decision_maker: sanitizeAnalysisField(raw.likely_decision_maker),
    opening_line: sanitizeAnalysisField(raw.opening_line),
    recommended_cta: sanitizeAnalysisField(raw.recommended_cta),
    urgency_score: sanitizeScore(raw.urgency_score),
    recruitment_opportunity_score: sanitizeScore(raw.recruitment_opportunity_score),
    opportunity_tier: raw.opportunity_tier ?? null,
  });

  return finalizeRecruitmentAnalysis(analysis);
}

export async function generateRecruitmentIntelligence(
  input: RecruitmentIntelligenceInput,
): Promise<GeneratedRecruitmentIntelligence> {
  if (!hasMinimalData(input)) {
    return { analysis: emptyRecruitmentIntelligenceAnalysis(), model: null };
  }

  if (!isOpenAIConfiguredForActiveOrg()) {
    return { analysis: buildFallbackRecruitmentIntelligence(input), model: null };
  }

  try {
    const client = getOpenAIClient();
    const payload = buildRecruitmentIntelligencePayload(input);

    const response = await client.chat.completions.create({
      model: ANALYSIS_MODEL,
      temperature: 0.1,
      max_tokens: 1600,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: RECRUITMENT_INTELLIGENCE_SCHEMA_NAME,
          strict: true,
          schema: RECRUITMENT_INTELLIGENCE_JSON_SCHEMA,
        },
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: payload },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { analysis: buildFallbackRecruitmentIntelligence(input), model: ANALYSIS_MODEL };
    }

    const raw = JSON.parse(content) as Record<string, unknown>;
    return { analysis: mapRawAnalysis(raw), model: ANALYSIS_MODEL };
  } catch {
    return { analysis: buildFallbackRecruitmentIntelligence(input), model: null };
  }
}
