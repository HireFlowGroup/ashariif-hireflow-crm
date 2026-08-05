import "server-only";

import type {
  AiEmailWriterDraft,
  AiEmailWriterInput,
  AiEmailWriterStyle,
} from "@/features/ai-email-writer/domain/ai-email-writer.types";
import {
  AI_EMAIL_WRITER_JSON_SCHEMA,
  AI_EMAIL_WRITER_SCHEMA_NAME,
} from "@/features/ai-email-writer/services/ai-email-writer-json-schema";
import { INSUFFICIENT_DATA } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { getOpenAIClient } from "@/lib/ai/client";
import { isOpenAIConfiguredForActiveOrg } from "@/lib/ai/client";

export const MAX_EMAIL_WORDS = 170;

const BANNED_PHRASES = [
  "baanbrekend",
  "uniek aanbod",
  "ik hoop dat deze mail u goed bereikt",
  "revolutionair",
  "marktleider",
  "game-changer",
  "beste recruitmentbureau",
  "mis deze kans niet",
  "ik wilde even",
  "leading",
  "innovative",
  "passionate",
  "dynamic",
  "full service",
  "kandidaten beschikbaar",
  "cv's",
  "cv ",
  "profielen aanbieden",
  "talentpool",
];

const SYSTEM_PROMPT = `Je bent Senior AI Email Writer bij HireFlow Group.

DOEL: nieuwe recruitmentopdrachten binnenhalen — NIET kandidaten verkopen of CV's aanbieden.

STRICTE REGELS:
- Gebruik UITSLUITEND feiten uit de meegeleverde Recruitment Intelligence analyse en vacaturelijst.
- Verzin geen namen, cijfers, vacatures of situaties die niet in de analyse staan.
- Gebruik de opening_line uit de analyse als basis voor personal_introduction (indien beschikbaar).
- Gebruik recommended_cta uit de analyse als call_to_action (indien beschikbaar).
- Geen spam, geen clichés, geen overdreven sales-taal.
- Professioneel Nederlands, menselijk en kort.
- Maximaal ${MAX_EMAIL_WORDS} woorden totaal (alle secties samen in de uiteindelijke mail).
- Doel: kennismakingsgesprek — geen directe opdracht pushen.
- Gebruik exact de opgegeven aanhef in personal_introduction.
- closing eindigt met: "Met vriendelijke groet,\\nHireFlow Group"
- Vermijd: ${BANNED_PHRASES.join(", ")}`;

const STYLE_INSTRUCTIONS: Record<Exclude<AiEmailWriterStyle, "new_version">, string> = {
  shorter: `Herschrijf korter — max ${MAX_EMAIL_WORDS - 40} woorden totaal. Behoud feiten en CTA.`,
  formal: "Herschrijf formeler en zakelijker. Behoud alle feiten uit de analyse.",
  personal: "Herschrijf persoonlijker en warmer. Behoud alle feiten uit de analyse.",
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

function containsBannedPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some((phrase) => lower.includes(phrase));
}

export function buildEmailWriterContextPayload(input: AiEmailWriterInput): string {
  const vacancyLines =
    input.vacancies.length === 0
      ? "Geen vacatures in context."
      : input.vacancies
          .slice(0, 15)
          .map((v) => `- ${v.title} (${v.status})${v.location ? ` · ${v.location}` : ""}`)
          .join("\n");

  const { analysisFacts: a } = input;

  return [
    "=== BEDRIJF ===",
    `Naam: ${input.company.name}`,
    `Website: ${input.company.website ?? "onbekend"}`,
    `Sector: ${input.company.sector ?? "onbekend"}`,
    `Locatie: ${input.company.city ?? "onbekend"}`,
    "",
    "=== CONTACTPERSOON ===",
    `Naam: ${input.contact.name ?? "onbekend"}`,
    `Functie: ${input.contact.jobTitle ?? "onbekend"}`,
    `E-mail: ${input.contact.email}`,
    `Aanhef (gebruik exact): ${input.salutation}`,
    "",
    "=== VACATURES ===",
    vacancyLines,
    "",
    "=== RECRUITMENT INTELLIGENCE (enige bron voor feiten) ===",
    `Samenvatting: ${a.company_summary}`,
    `Waarom recruitmentbureau: ${a.why_agency}`,
    `Pijn: ${a.likely_pain_points}`,
    `Waarom HireFlow: ${a.why_hireflow}`,
    `Moeilijke rollen: ${a.hard_to_fill_roles}`,
    `Urgentie: ${a.urgency_rationale}`,
    `Kans op opdracht: ${a.opportunity_chance_rationale}`,
    `Beslisser: ${a.likely_decision_maker}`,
    `Openingszin (gebruik als basis): ${a.opening_line}`,
    `CTA (gebruik als basis): ${a.recommended_cta}`,
    `Opportunity score: ${a.recruitment_opportunity_score ?? "onbekend"} (${a.opportunity_tier ?? "onbekend"})`,
  ].join("\n");
}

export function assembleEmailBody(draft: Omit<AiEmailWriterDraft, "bodyText" | "wordCount">): string {
  return [
    draft.personalIntroduction,
    "",
    draft.observedSituation,
    "",
    draft.whyHireFlow,
    "",
    draft.callToAction,
    "",
    draft.closing,
  ].join("\n");
}

function mapRawDraft(raw: Record<string, unknown>, salutation: string): AiEmailWriterDraft | null {
  const sections = {
    subject: typeof raw.subject === "string" ? raw.subject.trim() : "",
    personalIntroduction:
      typeof raw.personal_introduction === "string" ? raw.personal_introduction.trim() : "",
    observedSituation:
      typeof raw.observed_situation === "string" ? raw.observed_situation.trim() : "",
    whyHireFlow: typeof raw.why_hireflow === "string" ? raw.why_hireflow.trim() : "",
    callToAction: typeof raw.call_to_action === "string" ? raw.call_to_action.trim() : "",
    closing: typeof raw.closing === "string" ? raw.closing.trim() : "",
  };

  if (!sections.subject || !sections.personalIntroduction) return null;

  if (!sections.personalIntroduction.includes(salutation.split(",")[0] ?? salutation)) {
    sections.personalIntroduction = `${salutation}\n\n${sections.personalIntroduction}`;
  }

  let bodyText = assembleEmailBody(sections);
  if (containsBannedPhrase(bodyText)) return null;

  if (countWords(bodyText) > MAX_EMAIL_WORDS) {
    bodyText = truncateWords(bodyText, MAX_EMAIL_WORDS);
  }

  return {
    ...sections,
    bodyText,
    wordCount: countWords(bodyText),
  };
}

export function buildFallbackEmailDraft(input: AiEmailWriterInput): AiEmailWriterDraft {
  const { analysisFacts, salutation, company } = input;
  const hasFacts = analysisFacts.recruitment_opportunity_score !== null
    && analysisFacts.why_agency !== INSUFFICIENT_DATA;

  const personalIntroduction =
    analysisFacts.opening_line !== INSUFFICIENT_DATA
      ? `${salutation}\n\n${analysisFacts.opening_line}`
      : `${salutation}\n\nIk neem kort contact op over recruitment-ondersteuning.`;

  const observedSituation =
    analysisFacts.why_agency !== INSUFFICIENT_DATA
      ? analysisFacts.why_agency
      : analysisFacts.likely_pain_points !== INSUFFICIENT_DATA
        ? analysisFacts.likely_pain_points
        : INSUFFICIENT_DATA;

  const whyHireFlow =
    analysisFacts.why_hireflow !== INSUFFICIENT_DATA
      ? analysisFacts.why_hireflow
      : INSUFFICIENT_DATA;

  const callToAction =
    analysisFacts.recommended_cta !== INSUFFICIENT_DATA
      ? analysisFacts.recommended_cta
      : "Zou een kort kennismakingsgesprek van 15 minuten volgende week schikken?";

  const closing = "Met vriendelijke groet,\nHireFlow Group";

  const subject =
    analysisFacts.hard_to_fill_roles !== INSUFFICIENT_DATA
      ? `${company.name} — ${analysisFacts.hard_to_fill_roles.split(",")[0]?.trim()}`
      : `${company.name} — even sparren over hiring?`;

  const draft: Omit<AiEmailWriterDraft, "bodyText" | "wordCount"> = {
    subject: hasFacts ? subject : `${company.name} — recruitment-ondersteuning`,
    personalIntroduction,
    observedSituation,
    whyHireFlow,
    callToAction,
    closing,
  };

  let bodyText = assembleEmailBody(draft);
  if (countWords(bodyText) > MAX_EMAIL_WORDS) {
    bodyText = truncateWords(bodyText, MAX_EMAIL_WORDS);
  }

  return { ...draft, bodyText, wordCount: countWords(bodyText) };
}

async function callGpt(
  userContent: string,
  salutation: string,
): Promise<AiEmailWriterDraft | null> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.45,
    max_tokens: 900,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: AI_EMAIL_WRITER_SCHEMA_NAME,
        strict: true,
        schema: AI_EMAIL_WRITER_JSON_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  return mapRawDraft(JSON.parse(content) as Record<string, unknown>, salutation);
}

export async function generateAiEmailDraft(input: AiEmailWriterInput): Promise<AiEmailWriterDraft> {
  if (!isOpenAIConfiguredForActiveOrg()) {
    return buildFallbackEmailDraft(input);
  }

  try {
    const payload = buildEmailWriterContextPayload(input);
    const draft = await callGpt(
      `${payload}\n\nSchrijf een outreach-mail om een recruitmentopdracht te winnen. Geen kandidaten aanbieden.`,
      input.salutation,
    );
    return draft ?? buildFallbackEmailDraft(input);
  } catch {
    return buildFallbackEmailDraft(input);
  }
}

export async function rewriteAiEmailDraft(
  input: AiEmailWriterInput,
  current: AiEmailWriterDraft,
  style: AiEmailWriterStyle,
): Promise<AiEmailWriterDraft> {
  if (style === "new_version") {
    return generateAiEmailDraft(input);
  }

  if (!isOpenAIConfiguredForActiveOrg()) {
    return current;
  }

  const instruction = STYLE_INSTRUCTIONS[style];
  const userContent = [
    buildEmailWriterContextPayload(input),
    "",
    "=== HUIDIGE MAIL ===",
    `Onderwerp: ${current.subject}`,
    current.bodyText,
    "",
    instruction,
    "Geef dezelfde JSON-structuur terug.",
  ].join("\n");

  try {
    const draft = await callGpt(userContent, input.salutation);
    return draft ?? current;
  } catch {
    return current;
  }
}
