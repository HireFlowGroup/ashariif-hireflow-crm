import "server-only";

import type { Company } from "@/features/companies/domain";
import type { OutreachPersonalizationData } from "@/features/outreach-engine/domain/types";
import { isOpenAIConfigured } from "@/lib/env";
import { getOpenAIClient } from "@/lib/openai/client";

export type PersonalizationInput = {
  company: Company;
  recipientName: string | null;
  hiringSignal: string | null;
};

export type PersonalizedEmail = {
  subject: string;
  bodyText: string;
  personalization: OutreachPersonalizationData;
};

const MAX_WORDS = 140;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateToWordLimit(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

function buildFallbackEmail(input: PersonalizationInput): PersonalizedEmail {
  const { company, recipientName, hiringSignal } = input;
  const greeting = recipientName ? `Beste ${recipientName.split(" ")[0]},` : "Goedemiddag,";
  const location = company.city ? ` in ${company.city}` : "";
  const sector = company.sector ? ` in de ${company.sector}` : "";

  const signalLine = hiringSignal
    ? ` Ik zag recent signalen rondom ${hiringSignal.toLowerCase()}.`
    : "";

  const bodyText = truncateToWordLimit(
    [
      greeting,
      "",
      `Ik neem contact op namens HireFlow Group. We ondersteunen organisaties${sector}${location} bij het invullen van vacatures en het versterken van teams.${signalLine}`,
      "",
      "Zou het passen om kort kennis te maken? Ik hoor graag of er op dit moment behoefte is aan ondersteuning.",
      "",
      "Met vriendelijke groet,",
      "HireFlow Group",
    ].join("\n"),
    MAX_WORDS,
  );

  const fieldsUsed = ["companyName", company.sector ? "sector" : "", company.city ? "city" : "", hiringSignal ? "hiringSignal" : ""]
    .filter(Boolean) as string[];

  return {
    subject: `Kennismaking HireFlow Group — ${company.name}`,
    bodyText,
    personalization: {
      companyName: company.name,
      sector: company.sector,
      city: company.city,
      contactName: recipientName,
      vacancyCount: company.vacancyCount,
      hiringSignal,
      fieldsUsed,
      warnings: hiringSignal ? [] : ["Geen hiring signal — algemene intro gebruikt"],
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function generatePersonalizedEmail(input: PersonalizationInput): Promise<PersonalizedEmail> {
  if (!isOpenAIConfigured()) {
    return buildFallbackEmail(input);
  }

  try {
    const client = getOpenAIClient();
    const facts = [
      `Bedrijf: ${input.company.name}`,
      input.company.sector ? `Sector: ${input.company.sector}` : null,
      input.company.city ? `Locatie: ${input.company.city}` : null,
      input.company.vacancyCount > 0 ? `Vacatures: ${input.company.vacancyCount}` : null,
      input.hiringSignal ? `Hiring signal: ${input.hiringSignal}` : null,
      input.recipientName ? `Contact: ${input.recipientName}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Schrijf een zakelijke Nederlandse introductiemail namens HireFlow Group (recruitment).

STRICTE REGELS:
- Maximaal ${MAX_WORDS} woorden in bodyText
- Professioneel, menselijk, kort, niet commercieel
- Geen clichés, geen verzonnen feiten
- Alleen feiten uit onderstaande data gebruiken
- Bij onvoldoende data: korte algemene mail zonder nep-personalisatie
- Eén duidelijke call-to-action (kennismakingsgesprek)
- Geen claims die niet in de data staan

FEITEN:
${facts}

Antwoord ALLEEN als JSON:
{
  "subject": "onderwerpregel",
  "bodyText": "e-mailtekst met aanhef en afsluiting",
  "fieldsUsed": ["veldnamen uit data die gebruikt zijn"],
  "warnings": ["eventuele waarschuwingen"]
}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return buildFallbackEmail(input);

    const parsed = JSON.parse(content) as {
      subject?: string;
      bodyText?: string;
      fieldsUsed?: string[];
      warnings?: string[];
    };

    const bodyText = truncateToWordLimit(parsed.bodyText ?? "", MAX_WORDS);

    return {
      subject: parsed.subject ?? `Kennismaking — ${input.company.name}`,
      bodyText,
      personalization: {
        companyName: input.company.name,
        sector: input.company.sector,
        city: input.company.city,
        contactName: input.recipientName,
        vacancyCount: input.company.vacancyCount,
        hiringSignal: input.hiringSignal,
        fieldsUsed: parsed.fieldsUsed ?? [],
        warnings: parsed.warnings ?? [],
        generatedAt: new Date().toISOString(),
      },
    };
  } catch {
    return buildFallbackEmail(input);
  }
}
