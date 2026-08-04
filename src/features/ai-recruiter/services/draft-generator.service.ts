import "server-only";

import type { Company } from "@/features/companies/domain";
import type { OutreachDraftContent } from "@/features/ai-recruiter/domain/types";
import { outreachDraftContentSchema } from "@/features/ai-recruiter/domain/types";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { isOpenAIConfigured } from "@/platform/config/env";
import { getOpenAIClient } from "@/lib/ai/client";

const MAX_WORDS = 130;
const BANNED_PHRASES = [
  "baanbrekend",
  "uniek aanbod",
  "ik hoop dat deze mail u goed bereikt",
  "revolutionair",
  "marktleider",
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

function buildFallbackDraft(
  company: Company,
  contactName: string | null,
  hiring: HiringIntelligenceProfile,
): OutreachDraftContent {
  const greeting = contactName ? `Beste ${contactName.split(" ")[0]},` : "Goedemiddag,";
  const signal = hiring.signals[0]?.description;
  const signalLine = signal ? ` Ik zag recent ${signal.toLowerCase()}.` : "";
  const sector = company.sector ? ` in de ${company.sector}` : "";
  const city = company.city ? ` (${company.city})` : "";

  const bodyText = truncateWords(
    [
      greeting,
      "",
      `Ik neem contact op namens HireFlow Group. Wij ondersteunen organisaties${sector}${city} bij het invullen van vacatures.${signalLine}`,
      "",
      "Zou het passen om kort kennis te maken? Ik hoor graag of er op dit moment behoefte is aan ondersteuning.",
      "",
      "Met vriendelijke groet,",
      "HireFlow Group",
    ].join("\n"),
    MAX_WORDS,
  );

  const warnings = hiring.warnings.length ? hiring.warnings : [];
  if (!signal) warnings.push("beperkte personalisatie");

  const subjects = [
    `Kennismaking HireFlow — ${company.name}`,
    `${company.name}: ondersteuning bij werving`,
    `Recruitment — ${company.name}`,
  ];

  return outreachDraftContentSchema.parse({
    subjectOptions: subjects,
    recommendedSubject: subjects[0],
    bodyText,
    bodyHtml: null,
    personalizationSources: [
      company.name,
      company.sector,
      company.city,
      signal,
    ].filter(Boolean) as string[],
    factualClaims: hiring.explanations.slice(0, 3),
    warnings,
    confidence: signal ? 0.75 : 0.5,
  });
}

export async function generateRecruiterOutreachDraft(
  company: Company,
  contactName: string | null,
  hiring: HiringIntelligenceProfile,
): Promise<OutreachDraftContent> {
  if (!isOpenAIConfigured()) {
    return buildFallbackDraft(company, contactName, hiring);
  }

  const facts = [
    `Bedrijf: ${company.name}`,
    company.sector ? `Sector: ${company.sector}` : null,
    company.city ? `Locatie: ${company.city}` : null,
    hiring.vacancyCount > 0 ? `Vacatures: ${hiring.vacancyCount}` : null,
    hiring.signals[0] ? `Signaal: ${hiring.signals[0].description}` : null,
    contactName ? `Contact: ${contactName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Schrijf een Nederlandse B2B introductiemail namens HireFlow Group (recruitment).
Max ${MAX_WORDS} woorden. Professioneel, menselijk, kort. Geen clichés. Geen verzonnen feiten.
Vermijd: ${BANNED_PHRASES.join(", ")}.
Eén call-to-action. Bij weinig feiten: korte algemene mail + waarschuwing.`,
        },
        {
          role: "user",
          content: `FEITEN:\n${facts}\n\nJSON: { subjectOptions:[3 strings], recommendedSubject, bodyText, bodyHtml|null, personalizationSources[], factualClaims[], warnings[], confidence:0-1 }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return buildFallbackDraft(company, contactName, hiring);

    const parsed = outreachDraftContentSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return buildFallbackDraft(company, contactName, hiring);

    let bodyText = parsed.data.bodyText;
    for (const phrase of BANNED_PHRASES) {
      if (bodyText.toLowerCase().includes(phrase)) {
        return buildFallbackDraft(company, contactName, hiring);
      }
    }

    if (countWords(bodyText) > MAX_WORDS) {
      bodyText = truncateWords(bodyText, MAX_WORDS);
    }

    return { ...parsed.data, bodyText };
  } catch {
    return buildFallbackDraft(company, contactName, hiring);
  }
}
