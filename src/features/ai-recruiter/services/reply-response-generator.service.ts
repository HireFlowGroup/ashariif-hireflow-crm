import "server-only";

import type { ReplyClassification, SuggestedReply } from "@/features/ai-recruiter/domain/types";
import { suggestedReplySchema } from "@/features/ai-recruiter/domain/types";
import { buildOutreachSalutation } from "@/features/contact-finder/services/contact-validation.service";
import { isOpenAIConfigured } from "@/platform/config/env";
import { getOpenAIClient } from "@/lib/ai/client";

export type ReplyResponseContext = {
  companyName: string;
  contactName: string | null;
  originalSubject: string | null;
  replySubject: string | null;
  replyBody: string;
  isGeneralMailbox?: boolean;
  contactEmail?: string | null;
};

const ACCOUNT_MANAGER_SYSTEM_PROMPT = `Je bent een ervaren accountmanager bij HireFlow Group (recruitment).
Schrijf een voorgesteld antwoord op een binnenkomende e-mailreactie in het Nederlands.

REGELS:
- Professioneel, warm en nuchter — geen verkooppraat of druk
- Reageer concreet op wat de afzender schreef
- Kort: 60–120 woorden
- Eén duidelijke vervolgstap
- Geen "ik wilde even", geen hype
- Ondertekening: "Met vriendelijke groet,\\nHireFlow Group"
- Bij automatisch antwoord, out of office of spam: shouldSend=false, bodyText=null`;

function buildFallbackSuggestedReply(
  classification: ReplyClassification,
  context: ReplyResponseContext,
): SuggestedReply {
  const greeting = buildOutreachSalutation(
    context.contactName,
    context.isGeneralMailbox ?? !context.contactName,
    context.contactEmail ?? "info@bedrijf.nl",
  );

  const reSubject = context.originalSubject
    ? context.originalSubject.startsWith("Re:")
      ? context.originalSubject
      : `Re: ${context.originalSubject}`
    : `Re: ${context.companyName}`;

  switch (classification) {
    case "nieuwe_opdracht":
      return suggestedReplySchema.parse({
        subject: reSubject,
        bodyText: [
          greeting,
          "",
          "Bedankt voor uw bericht — fijn dat u HireFlow Group in overweging neemt.",
          "",
          "Ik plan graag een kort gesprek om de vacature(s), planning en verwachtingen door te nemen. Welke dag en tijd past u deze week?",
          "",
          "Met vriendelijke groet,",
          "HireFlow Group",
        ].join("\n"),
        shouldSend: true,
        confidence: 0.82,
      });

    case "interesse":
      return suggestedReplySchema.parse({
        subject: reSubject,
        bodyText: [
          greeting,
          "",
          "Bedankt voor uw reactie. Fijn om te horen dat u openstaat voor een kennismaking.",
          "",
          "Ik stuur graag een paar tijdsloten door — heeft u voorkeur voor deze of volgende week?",
          "",
          "Met vriendelijke groet,",
          "HireFlow Group",
        ].join("\n"),
        shouldSend: true,
        confidence: 0.84,
      });

    case "later":
      return suggestedReplySchema.parse({
        subject: reSubject,
        bodyText: [
          greeting,
          "",
          "Dank voor uw terugkoppeling. Ik noteer dat timing nu nog niet past.",
          "",
          "Mag ik u over een maand opnieuw benaderen? Laat gerust weten wanneer het beter uitkomt.",
          "",
          "Met vriendelijke groet,",
          "HireFlow Group",
        ].join("\n"),
        shouldSend: true,
        confidence: 0.8,
      });

    case "geen_interesse":
      return suggestedReplySchema.parse({
        subject: reSubject,
        bodyText: [
          greeting,
          "",
          "Bedankt voor uw heldere reactie. Ik respecteer dat dit nu geen prioriteit is.",
          "",
          "Mocht de situatie rond hiring veranderen, staan we graag klaar om mee te denken.",
          "",
          "Met vriendelijke groet,",
          "HireFlow Group",
        ].join("\n"),
        shouldSend: true,
        confidence: 0.86,
      });

    case "afgewezen":
      return suggestedReplySchema.parse({
        subject: reSubject,
        bodyText: [
          greeting,
          "",
          "Begrepen — ik zet u niet meer op onze mailinglijst. Bedankt voor uw terugkoppeling.",
          "",
          "Met vriendelijke groet,",
          "HireFlow Group",
        ].join("\n"),
        shouldSend: true,
        confidence: 0.9,
      });

    case "automatisch_antwoord":
    case "out_of_office":
    case "spam":
      return suggestedReplySchema.parse({
        subject: null,
        bodyText: null,
        shouldSend: false,
        confidence: 0.88,
      });

    default:
      return suggestedReplySchema.parse({
        subject: reSubject,
        bodyText: [
          greeting,
          "",
          "Bedankt voor uw reactie. Ik lees uw bericht zorgvuldig door en kom hier zo op terug.",
          "",
          "Met vriendelijke groet,",
          "HireFlow Group",
        ].join("\n"),
        shouldSend: false,
        confidence: 0.55,
      });
  }
}

export async function generateSuggestedReply(
  classification: ReplyClassification,
  context: ReplyResponseContext,
): Promise<SuggestedReply> {
  const fallback = buildFallbackSuggestedReply(classification, context);

  if (!isOpenAIConfigured() || !fallback.shouldSend) {
    return fallback;
  }

  const salutation = buildOutreachSalutation(
    context.contactName,
    context.isGeneralMailbox ?? !context.contactName,
    context.contactEmail ?? "info@bedrijf.nl",
  );

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ACCOUNT_MANAGER_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Classificatie: ${classification}`,
            `Bedrijf: ${context.companyName}`,
            `Aanhef (gebruik exact): ${salutation}`,
            `Origineel onderwerp: ${context.originalSubject ?? "—"}`,
            `Binnenkomend onderwerp: ${context.replySubject ?? "—"}`,
            `Binnenkomende mail:\n${context.replyBody.slice(0, 1500)}`,
            "",
            'JSON: { subject: string|null, bodyText: string|null, shouldSend: boolean, confidence: 0-1 }',
          ].join("\n"),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = suggestedReplySchema.safeParse(JSON.parse(content));
    if (!parsed.success) return fallback;

    if (parsed.data.bodyText?.toLowerCase().includes("ik wilde even")) {
      return fallback;
    }

    return parsed.data;
  } catch {
    return fallback;
  }
}
