import { isOpenAIConfigured } from "@/lib/env";
import { getOpenAIClient } from "@/lib/ai/client";
import type {
  OutreachChannel,
  OutreachContactCandidate,
  OutreachIntelligenceContext,
} from "@/features/outreach-intelligence/domain/types";

export type OutreachDraftResult = {
  draftSubject: string;
  draftBody: string;
  followUpSubject: string;
  followUpBody: string;
  model: string;
};

export async function generateOutreachDrafts(
  context: OutreachIntelligenceContext,
  contact: OutreachContactCandidate | null,
  channel: OutreachChannel,
  outreachAngle: string,
): Promise<OutreachDraftResult> {
  if (!isOpenAIConfigured()) {
    return fallbackDrafts(context, contact, channel, outreachAngle);
  }

  try {
    const client = getOpenAIClient();
    const contactLine = contact
      ? `${contact.name}${contact.jobTitle ? ` (${contact.jobTitle})` : ""}`
      : "geen specifiek contact — algemene outreach";

    const latestSignal = context.signals[0];
    const signalContext = latestSignal
      ? `Laatste signaal: ${latestSignal.signalType} — ${latestSignal.title ?? ""} (${latestSignal.observedAt})`
      : "Geen recente signalen";

    const prompt = `Je bent een B2B recruitment sales expert voor HireFlow (Nederland).
Schrijf outreach op basis van ALLEEN onderstaande feiten. Verzin geen cijfers of vacatures die niet genoemd zijn.

Bedrijf: ${context.companyName}
Sector: ${context.sector ?? "onbekend"}
Stad: ${context.city ?? "onbekend"}
Lead score: ${context.leadScore ?? "—"}
Priority: ${context.leadPriority ?? "—"}
Hiring intensity: ${context.hiringIntensity}
Vacatures: ${context.vacancyCount}
Contact: ${contactLine}
Kanaal: ${channel}
Outreach angle: ${outreachAngle}
${signalContext}
AI samenvatting: ${context.aiSummary ?? "geen"}

Antwoord ALLEEN als JSON:
{
  "draftSubject": "onderwerpregel NL",
  "draftBody": "e-mail/bericht NL, 120-180 woorden, professioneel, concreet, geen hype",
  "followUpSubject": "follow-up onderwerp NL",
  "followUpBody": "korte follow-up NL, 60-90 woorden, vriendelijk"
}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 900,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallbackDrafts(context, contact, channel, outreachAngle);

    const parsed = JSON.parse(content) as Partial<OutreachDraftResult>;
    return {
      draftSubject: parsed.draftSubject ?? fallbackDrafts(context, contact, channel, outreachAngle).draftSubject,
      draftBody: parsed.draftBody ?? fallbackDrafts(context, contact, channel, outreachAngle).draftBody,
      followUpSubject: parsed.followUpSubject ?? `Follow-up: ${context.companyName}`,
      followUpBody: parsed.followUpBody ?? fallbackDrafts(context, contact, channel, outreachAngle).followUpBody,
      model: "gpt-4o-mini",
    };
  } catch {
    return fallbackDrafts(context, contact, channel, outreachAngle);
  }
}

function fallbackDrafts(
  context: OutreachIntelligenceContext,
  contact: OutreachContactCandidate | null,
  channel: OutreachChannel,
  outreachAngle: string,
): OutreachDraftResult {
  const greeting = contact ? `Beste ${contact.name.split(" ")[0]},` : "Beste heer/mevrouw,";
  const channelNote =
    channel === "linkedin"
      ? "Ik zag uw profiel op LinkedIn en"
      : channel === "phone"
        ? "Ik bel u kort even over"
        : "Ik neem contact op over";

  return {
    draftSubject: `Samenwerking recruitment — ${context.companyName}`,
    draftBody: `${greeting}

${channelNote} de hiring activiteit bij ${context.companyName}. ${outreachAngle}

HireFlow ondersteunt recruitment teams met gerichte kandidaten en snellere invulling van vacatures. ${context.vacancyCount > 0 ? `Ik zie ${context.vacancyCount} openstaande vacature(s) — graag bespreek ik hoe wij kunnen helpen.` : "Graag verken ik of onze aanpak aansluit bij jullie hiring behoefte."}

Met vriendelijke groet,
HireFlow`,
    followUpSubject: `Re: ${context.companyName} — even checken`,
    followUpBody: `${greeting}

Ik wilde even follow-up doen op mijn eerdere bericht over recruitment ondersteuning voor ${context.companyName}. Heeft u 15 minuten deze week voor een kort gesprek?

Met vriendelijke groet,
HireFlow`,
    model: "fallback-template",
  };
}

export function buildOutreachAngle(context: OutreachIntelligenceContext): string {
  if (context.vacancyCount > 0) {
    return `HireFlow kan ondersteunen bij ${context.vacancyCount} openstaande vacature(s) bij ${context.companyName}.`;
  }

  const latestSignal = context.signals[0];
  if (latestSignal?.title) {
    return `Recent signaal: ${latestSignal.title} — proactieve outreach op hiring momentum.`;
  }

  if (context.leadPriority === "A" || context.leadPriority === "B") {
    return `${context.companyName} scoort hoog (priority ${context.leadPriority}) — geschikt voor proactieve outreach.`;
  }

  return `Prospect in ${context.sector ?? "onbekende sector"} — verken samenwerking met HireFlow.`;
}
