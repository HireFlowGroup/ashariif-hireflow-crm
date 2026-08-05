import type { OutreachIntelligenceContext } from "@/features/outreach-intelligence/domain/types";
import type {
  OutreachGeneratorContent,
  OutreachWritingStyle,
} from "@/features/outreach-generator/domain/generator.types";
import {
  buildOutreachGeneratorPayload,
  extractSignalLabels,
} from "@/features/outreach-generator/services/build-outreach-context";
import { getWritingStyleInstruction } from "@/features/outreach-generator/domain/writing-styles";

function greeting(contactName: string | null, style: OutreachWritingStyle): string {
  const firstName = contactName?.split(" ")[0] ?? null;

  if (style === "formal") {
    return firstName ? `Geachte ${firstName},` : "Geachte heer/mevrouw,";
  }

  return firstName ? `Hoi ${firstName},` : "Hoi,";
}

export function buildFallbackOutreachContent(
  context: OutreachIntelligenceContext,
  contactName: string | null,
  style: OutreachWritingStyle,
): OutreachGeneratorContent {
  const signals = extractSignalLabels(context);
  const primarySignal = signals[0] ?? "recente hiring activiteit";
  const secondarySignal = signals[1] ?? primarySignal;
  const greet = greeting(contactName, style);
  const company = context.companyName;

  const signalHook =
    style === "direct"
      ? `Ik zag ${primarySignal} bij ${company}.`
      : style === "formal"
        ? `Via onze intelligence monitoring is ${primarySignal} gesignaleerd bij ${company}.`
        : `Ik zag via HireFlow dat ${primarySignal} — dat viel me op bij ${company}.`;

  const vacancyNote =
    context.vacancyCount > 0
      ? ` Met ${context.vacancyCount} open vacature(s) in ons systeem.`
      : "";

  const coldBody = `${greet}

${signalHook}${vacancyNote}

HireFlow ondersteunt recruitment teams met gerichte invulling op basis van actuele hiring signalen — niet generieke sales, maar context uit jullie situatie.

Graag bespreek ik kort of onze aanpak aansluit.

Met vriendelijke groet,
HireFlow`;

  const linkedinBody = `${greet.replace(",", "")} — ${signalHook} Ik help recruitment teams met gerichte invulling. Heb je 15 min voor een kort gesprek?`;

  return {
    coldEmail: {
      subject: `${primarySignal} — ${company}`,
      body: coldBody,
      referencedSignals: [primarySignal],
    },
    linkedinMessage: {
      body: linkedinBody,
      referencedSignals: [primarySignal],
    },
    callScript: {
      opening: `${greet} u spreekt met HireFlow. Ik bel over ${primarySignal} bij ${company}.`,
      discovery: "Hoe pakt u de invulling van deze rol(s) momenteel aan?",
      valueProposition: `Wij helpen teams die te maken hebben met ${secondarySignal} met snellere, gerichte invulling.`,
      close: "Zullen we een kort vervolggesprek van 15 minuten inplannen?",
      referencedSignals: signals.slice(0, 2),
    },
    voicemail: {
      body: `Hoi, u spreekt met HireFlow. Ik bel over ${primarySignal} bij ${company}. Graag hoor ik van u — mijn nummer staat in uw inbox. Dank u wel.`,
      referencedSignals: [primarySignal],
    },
    followUp1: {
      subject: `Re: ${primarySignal} — ${company}`,
      body: `${greet}\n\nIn mijn eerdere mail over ${primarySignal} wilde ik kort terugkomen. HireFlow helpt recruitment teams met flexibele ondersteuning bij invulling.\n\nHeeft u deze week 15 minuten voor een kort gesprek?\n\nHireFlow`,
      referencedSignals: [primarySignal],
    },
    followUp2: {
      subject: `Nog een korte vraag — ${company}`,
      body: `${greet}\n\nIk begreep uit ${secondarySignal} dat er hiring-druk is. Past een kort gesprek deze week?\n\nHireFlow`,
      referencedSignals: [secondarySignal],
    },
    followUp3: {
      subject: `Laatste check — ${company}`,
      body: `${greet}\n\nIk sluit de lus even: ${primarySignal} blijft relevant in ons systeem. Laat gerust weten of dit nu niet past.\n\nHireFlow`,
      referencedSignals: [primarySignal],
    },
  };
}

export function buildOutreachGeneratorPrompt(
  context: OutreachIntelligenceContext,
  contactName: string | null,
  style: OutreachWritingStyle,
): string {
  const payload = buildOutreachGeneratorPayload(context, contactName);
  const styleInstruction = getWritingStyleInstruction(style);

  return `${payload}

=== OPDRACHT ===
Schrijfstijl: ${styleInstruction}

Genereer een volledig outreach-pakket in het Nederlands. Gebruik ALLEEN bovenstaande HireFlow-data.
REGELS:
- GEEN generieke sales-teksten of verzonnen feiten
- ELK onderdeel MOET minimaal één concreet hiring signal refereren (exacte titel/type uit de lijst)
- Geen hype, geen "marktleider", geen ongefundeerde claims
- Vacatures alleen noemen als ze in de data staan

Antwoord ALLEEN als JSON:
{
  "coldEmail": { "subject": "...", "body": "...", "referencedSignals": ["..."] },
  "linkedinMessage": { "body": "...", "referencedSignals": ["..."] },
  "callScript": { "opening": "...", "discovery": "...", "valueProposition": "...", "close": "...", "referencedSignals": ["..."] },
  "voicemail": { "body": "...", "referencedSignals": ["..."] },
  "followUp1": { "subject": "...", "body": "...", "referencedSignals": ["..."] },
  "followUp2": { "subject": "...", "body": "...", "referencedSignals": ["..."] },
  "followUp3": { "subject": "...", "body": "...", "referencedSignals": ["..."] }
}`;
}
