import "server-only";

import type { Company } from "@/features/companies/domain";
import type { OutreachDraftContent } from "@/features/ai-recruiter/domain/types";
import { outreachDraftContentSchema } from "@/features/ai-recruiter/domain/types";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { buildOutreachSalutation } from "@/features/contact-finder/services/contact-validation.service";
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

export type DraftRecipient = {
  recipientName: string | null;
  email: string;
  isGeneralMailbox: boolean;
};

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
  recipient: DraftRecipient,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
): OutreachDraftContent {
  const greeting = buildOutreachSalutation(
    recipient.recipientName,
    recipient.isGeneralMailbox,
    recipient.email,
  );
  const signal = hiring.signals[0]?.description;
  const signalLine = signal ? ` Ik zag recent ${signal.toLowerCase()}.` : "";
  const sector = company.sector ? ` in de ${company.sector}` : "";
  const city = company.city ? ` (${company.city})` : "";
  const vacancyLine =
    hiring.vacancyCount > 0
      ? ` Met betrekking tot uw openstaande vacature(s) bij ${company.name}`
      : "";

  const rolesLine =
    opportunity.rolesSought.length > 0
      ? ` Ik zie dat u onder andere zoekt naar: ${opportunity.rolesSought.slice(0, 2).join(", ")}.`
      : "";
  const approachLine = opportunity.bestApproach ? ` ${opportunity.bestApproach}` : "";

  const bodyText = truncateWords(
    [
      greeting,
      "",
      `Ik neem contact op namens HireFlow Group.${vacancyLine}${rolesLine} Wij helpen groeiende organisaties${sector}${city} met externe recruitment-ondersteuning — flexibel, zonder vaste FTE.${signalLine}`,
      "",
      `Zou het passen om kort te bespreken of wij u kunnen ondersteunen bij het invullen van openstaande rollen?${approachLine}`,
      "",
      "Met vriendelijke groet,",
      "HireFlow Group",
    ].join("\n"),
    MAX_WORDS,
  );

  const warnings = hiring.warnings.length ? [...hiring.warnings] : [];
  if (!signal) warnings.push("beperkte personalisatie");
  if (recipient.isGeneralMailbox) warnings.push("algemene mailbox — neutrale aanhef");

  const subjects = [
    `Recruitment-ondersteuning — ${company.name}`,
    `${company.name}: schaalbare hiring-ondersteuning`,
    `Externe recruitment — ${company.name}`,
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
  recipient: DraftRecipient | string | null,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
): Promise<OutreachDraftContent> {
  const normalizedRecipient: DraftRecipient =
    typeof recipient === "string" || recipient === null
      ? {
          recipientName: recipient,
          email: company.hrEmail ?? company.email ?? "info@bedrijf.nl",
          isGeneralMailbox: !recipient,
        }
      : recipient;

  if (!isOpenAIConfigured()) {
    return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);
  }

  const salutation = buildOutreachSalutation(
    normalizedRecipient.recipientName,
    normalizedRecipient.isGeneralMailbox,
    normalizedRecipient.email,
  );

  const facts = [
    `Bedrijf: ${company.name}`,
    company.sector ? `Sector: ${company.sector}` : null,
    company.city ? `Locatie: ${company.city}` : null,
    hiring.vacancyCount > 0 ? `Vacatures: ${hiring.vacancyCount}` : null,
    hiring.signals[0] ? `Signaal: ${hiring.signals[0].description}` : null,
    normalizedRecipient.recipientName ? `Contact: ${normalizedRecipient.recipientName}` : null,
    `Aanhef: ${salutation}`,
    opportunity.rolesSought.length ? `Gezochte functies: ${opportunity.rolesSought.join(", ")}` : null,
    `Opportunity score: ${opportunity.opportunityScore}`,
    `Invalshoek: ${opportunity.bestApproach}`,
    `Urgentie: ${opportunity.urgency}`,
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
          content: `Schrijf een Nederlandse B2B commerciële acquisition-mail namens HireFlow Group.
Doel: NIEUWE OPDRACHTGEVER — vraag of het bedrijf openstaat voor externe recruitment-ondersteuning (W&S-opdracht), NIET kandidaten aanbieden zonder toestemming.
Max ${MAX_WORDS} woorden. Professioneel, menselijk, kort. Geen clichés. Geen verzonnen feiten.
Gebruik exact de opgegeven aanhef. Bij algemene mailbox: neutrale HR/recruitment-toon.
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
    if (!content) return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);

    const parsed = outreachDraftContentSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);

    let bodyText = parsed.data.bodyText;
    for (const phrase of BANNED_PHRASES) {
      if (bodyText.toLowerCase().includes(phrase)) {
        return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);
      }
    }

    if (countWords(bodyText) > MAX_WORDS) {
      bodyText = truncateWords(bodyText, MAX_WORDS);
    }

    return { ...parsed.data, bodyText };
  } catch {
    return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);
  }
}
