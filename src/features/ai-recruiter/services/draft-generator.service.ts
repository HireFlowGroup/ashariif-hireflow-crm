import "server-only";

import type { Company } from "@/features/companies/domain";
import type { OutreachDraftContent } from "@/features/ai-recruiter/domain/types";
import { outreachDraftContentSchema } from "@/features/ai-recruiter/domain/types";
import {
  analyzeBdOutreachContext,
  pickVariantIndex,
} from "@/features/ai-recruiter/services/bd-outreach-analyzer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { buildOutreachSalutation } from "@/features/contact-finder/services/contact-validation.service";
import { isOpenAIConfigured } from "@/platform/config/env";
import { getOpenAIClient } from "@/lib/ai/client";

const MAX_WORDS = 140;
const MAX_FOLLOW_UP_WORDS = 120;

const BANNED_PHRASES = [
  "baanbrekend",
  "uniek aanbod",
  "ik hoop dat deze mail u goed bereikt",
  "revolutionair",
  "marktleider",
  "game-changer",
  "toonaangevend",
  "disruptief",
  "synergie",
  "beste recruitmentbureau",
  "unieke propositie",
  "oplossing voor al uw",
  "wij bieden een compleet pakket",
  "mis deze kans niet",
  "ik wilde even",
  "leading",
  "innovative",
  "cutting-edge",
  "state-of-the-art",
  "passionate",
  "dynamic",
  "wereld van morgen",
  "partner in success",
  "totale oplossing",
  "one-stop-shop",
  "game changing",
  "next level",
  "full service",
  "kwalitatief hoogwaardig",
  "uitgebreid netwerk",
  "jarenlange ervaring in het vakgebied",
];

const GENERIC_OPENERS = [
  "ik wilde even contact opnemen",
  "ik neem contact op over",
  "ik hoop dat alles goed gaat",
  "hopelijk bereikt deze mail u",
  "even een korte vraag",
];

const BD_CONSULTANT_SYSTEM_PROMPT = `Je bent Senior Business Development Consultant bij HireFlow Group.
Jouw enige KPI: nieuwe recruitmentopdrachten binnenhalen.

VOORDAT je schrijft, doorloop je intern (niet in de mail tonen):
1. Waarom zou dit bedrijf een recruitmentbureau inschakelen?
2. Welke pijn ervaren zij waarschijnlijk?
3. Waarom zouden ze HireFlow kiezen?

Gebruik uitsluitend relevante feiten uit de context. Verzin niets.

Schrijf de mail alsof je al jaren recruitment doet:
- Geen marketingtaal, buzzwords of clichés
- Kort, persoonlijk, menselijk, professioneel
- Gebruik de bedrijfsnaam, vacatures, hiring signalen, groeifase en branche
- Elke mail uniek — NOOIT twee dezelfde openingszinnen
- NOOIT generieke teksten
- Doel: kennismakingsgesprek van 15 minuten — NIET direct een opdracht verkopen
- Sluit af met één eenvoudige vraag waarop makkelijk 'ja' kan worden gezegd
- Geen kandidaten aanbieden zonder toestemming
- Gebruik exact de opgegeven aanhef
- Maximaal ${MAX_WORDS} woorden in bodyText
- Ondertekening: "Met vriendelijke groet,\\nHireFlow Group"
- subjectOptions: 3 korte, menselijke onderwerpregels (geen sales)
- Vermijd: ${BANNED_PHRASES.join(", ")}`;

export type DraftRecipient = {
  recipientName: string | null;
  email: string;
  isGeneralMailbox: boolean;
};

export type PreviousOutreachDraft = {
  subject: string;
  bodyText: string;
};

export type RecruiterFollowUpDraft = {
  subject: string;
  bodyText: string;
  warnings: string[];
  confidence: number;
};

const FOLLOW_UP_BANNED_PHRASES = [
  ...BANNED_PHRASES,
  "even follow-up",
  "laatste kans",
  "mis niet",
  "dringend",
  "nu nog",
  "alleen vandaag",
  "steeds geen reactie",
  "hopelijk leest u",
];

const FOLLOW_UP_SYSTEM_PROMPT = `Je bent Senior Business Development Consultant bij HireFlow Group.
Schrijf een follow-up e-mail in het Nederlands — vriendelijk professioneel, nooit opdringerig.

STRUCTUUR:
1. Verwijs kort naar je eerdere mail (onderwerp of inhoud)
2. Herhaal kort waarom HireFlow kan helpen (praktisch, nuchter)
3. Eén duidelijke vraag of actie — geen meerdere opties

REGELS:
- Maximaal ${MAX_FOLLOW_UP_WORDS} woorden in bodyText
- NOOIT: "ik wilde even", druk uitoefenen, meerdere CTAs
- Geen hype, marketingtaal of buzzwords
- Gebruik exact de opgegeven aanhef
- Ondertekening: "Met vriendelijke groet,\\nHireFlow Group"
- subject: kort, met referentie naar eerdere mail (bijv. "Re: ...")`;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

function isGrowthSignal(description: string): boolean {
  return /groei|uitbreid|scale-up|funding|investering|nieuw kantoor|headcount/i.test(description);
}

function buildVariedOpener(
  company: Company,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
): string {
  const seed = company.id ?? company.name;
  const roles = opportunity.rolesSought.slice(0, 2);
  const role = hiring.vacancyTitles[0] ?? roles[0];
  const growthSignal = hiring.signals.find(
    (s) => isGrowthSignal(s.description ?? "") || isGrowthSignal(s.type),
  );
  const sector = company.sector;
  const city = company.city;

  const vacancyOpeners: string[] = [];
  if (roles.length >= 2) {
    vacancyOpeners.push(
      `${company.name} zoekt momenteel onder andere ${roles.join(" en ")} — dat viel me op.`,
      `Op de careers-pagina van ${company.name} staan ${roles.join(" en ")} open.`,
      `Tussen de vacatures bij ${company.name} vielen ${roles.join(" en ")} me op.`,
    );
  } else if (role) {
    vacancyOpeners.push(
      `De vacature ${role} bij ${company.name} trok mijn aandacht.`,
      `${company.name} heeft ${role} open staan${city ? ` in ${city}` : ""}.`,
      `Ik keek mee op de hiring-pagina van ${company.name} — ${role} staat open.`,
    );
  }

  if (hiring.vacancyCount >= 2 && !roles.length) {
    vacancyOpeners.push(
      `${company.name} heeft op dit moment ${hiring.vacancyCount} vacatures open staan.`,
      `Bij ${company.name} lopen meerdere rollen tegelijk — ${hiring.vacancyCount} vacatures.`,
    );
  }

  const signalOpeners: string[] = [];
  if (growthSignal?.description) {
    const desc = growthSignal.description.replace(/\.$/, "");
    signalOpeners.push(
      `Recent zag ik dat ${company.name} ${desc.charAt(0).toLowerCase()}${desc.slice(1)}.`,
      `In ${company.sector ?? "de markt"} viel ${company.name} me op: ${desc}.`,
    );
  }

  const topSignal = hiring.signals[0]?.description;
  if (topSignal && topSignal !== growthSignal?.description) {
    signalOpeners.push(
      `${company.name} kwam op mijn radar door ${topSignal.charAt(0).toLowerCase()}${topSignal.slice(1).replace(/\.$/, "")}.`,
    );
  }

  const sectorOpeners: string[] = [];
  if (sector) {
    sectorOpeners.push(
      `${company.name} opereert in ${sector}${city ? ` (${city})` : ""} — een markt waar hiring vaak voelbaar is.`,
      `In ${sector} zie ik ${company.name}${city ? ` (${city})` : ""} actief werven.`,
    );
  }

  const allOpeners = [...vacancyOpeners, ...signalOpeners, ...sectorOpeners];
  if (allOpeners.length === 0) {
    allOpeners.push(
      `${company.name} lijkt actief bezig met hiring — daarom schrijf ik u.`,
    );
  }

  return allOpeners[pickVariantIndex(seed, allOpeners.length)]!;
}

function buildPainLine(
  company: Company,
  hiring: HiringIntelligenceProfile,
  analysis: ReturnType<typeof analyzeBdOutreachContext>,
): string {
  if (hiring.vacancyCount >= 2) {
    return `Met ${hiring.vacancyCount} vacatures tegelijk merk ik dat dit vaak druk geeft op interne recruitment${company.sector ? ` — zeker in ${company.sector}` : ""}.`;
  }
  if (analysis.growthStage?.includes("scale-up") || analysis.growthStage?.includes("groei")) {
    return `${analysis.growthStage} betekent meestal dat hiring sneller gaat dan interne capaciteit kan bijbenen.`;
  }
  return analysis.likelyPain.replace(/^Waarschijnlijke pijn:\s*/i, "Ik hoor vaker dat ");
}

function buildHireFlowLine(analysis: ReturnType<typeof analyzeBdOutreachContext>): string {
  return analysis.whyHireFlow.replace(/\.$/, "") + ".";
}

function buildSimpleYesQuestion(company: Company): string {
  const questions = [
    "Hebben jullie volgende week 15 minuten voor een kort kennismakingsgesprek?",
    "Zou een belletje van 15 minuten volgende week passen?",
    "Staat u open voor 15 minuten kennismaken — zonder verplichtingen?",
    "Is een kort gesprek van 15 minuten iets voor u?",
    "Kunnen we volgende week 15 minuten sparren over jullie hiring?",
  ];
  return questions[pickVariantIndex(company.id ?? company.name, questions.length)]!;
}

function buildPreviousMailReference(company: Company, previous: PreviousOutreachDraft): string {
  const topic = previous.subject.replace(/^Re:\s*/i, "").trim();
  if (topic && topic !== company.name) {
    return `In mijn eerdere mail over ${topic} ging het om de hiring-situatie bij ${company.name}.`;
  }
  return `In mijn eerdere bericht over de hiring-situatie bij ${company.name} wilde ik kort terugkomen.`;
}

function buildHireFlowFollowUpLine(): string {
  return "HireFlow Group ondersteunt teams met flexibele recruitment-capaciteit — meedenken en opschalen wanneer interne werving krap wordt.";
}

function buildFallbackFollowUp(
  company: Company,
  recipient: DraftRecipient,
  hiring: HiringIntelligenceProfile,
  previous: PreviousOutreachDraft,
): RecruiterFollowUpDraft {
  const greeting = buildOutreachSalutation(
    recipient.recipientName,
    recipient.isGeneralMailbox,
    recipient.email,
  );

  const reference = buildPreviousMailReference(company, previous);
  const help = buildHireFlowFollowUpLine();

  let contextLine: string | null = null;
  if (hiring.vacancyCount >= 2) {
    contextLine = "Met meerdere vacatures tegelijk merk ik dat dit vaak extra capaciteit vraagt.";
  } else if (hiring.vacancyTitles[0]) {
    contextLine = `Rond de vacature voor ${hiring.vacancyTitles[0]} zien wij regelmatig dat extra ondersteuning helpt.`;
  }

  const bodyText = truncateWords(
    [
      greeting,
      "",
      reference,
      contextLine,
      "",
      help,
      "",
      buildSimpleYesQuestion(company),
      "",
      "Met vriendelijke groet,",
      "HireFlow Group",
    ]
      .filter(Boolean)
      .join("\n"),
    MAX_FOLLOW_UP_WORDS,
  );

  const subject = previous.subject.startsWith("Re:")
    ? previous.subject
    : `Re: ${previous.subject}`;

  const warnings: string[] = [];
  if (recipient.isGeneralMailbox) warnings.push("algemene mailbox — neutrale aanhef");

  return {
    subject,
    bodyText,
    warnings,
    confidence: hiring.signals.length > 0 || hiring.vacancyCount > 0 ? 0.75 : 0.5,
  };
}

function buildFactsPayload(
  company: Company,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
  recipient: DraftRecipient,
  salutation: string,
  analysis: ReturnType<typeof analyzeBdOutreachContext>,
): string {
  const growthSignals = hiring.signals
    .filter((s) => isGrowthSignal(s.description ?? "") || isGrowthSignal(s.type))
    .map((s) => s.description ?? s.title)
    .slice(0, 3);

  return [
    `Bedrijf: ${company.name}`,
    company.sector ? `Branche: ${company.sector}` : null,
    company.city ? `Locatie: ${company.city}` : null,
    company.employeeCount ? `Omvang: ~${company.employeeCount} medewerkers` : null,
    analysis.growthStage ? `Groeifase: ${analysis.growthStage}` : null,
    hiring.vacancyCount > 0 ? `Vacatures: ${hiring.vacancyCount}` : "Geen vacatures in data",
    hiring.vacancyTitles.length ? `Vacaturetitels: ${hiring.vacancyTitles.join(", ")}` : null,
    opportunity.rolesSought.length ? `Gezochte functies: ${opportunity.rolesSought.join(", ")}` : null,
    growthSignals.length ? `Groei/uitbreiding: ${growthSignals.join("; ")}` : null,
    hiring.signals.length
      ? `Hiring signalen:\n${hiring.signals.slice(0, 5).map((s) => `- ${s.description ?? s.title}`).join("\n")}`
      : null,
    opportunity.why.length ? `Context: ${opportunity.why.slice(0, 3).join("; ")}` : null,
    `Analyse — waarom bureau: ${analysis.whyAgency}`,
    `Analyse — pijn: ${analysis.likelyPain}`,
    `Analyse — waarom HireFlow: ${analysis.whyHireFlow}`,
    recipient.recipientName ? `Contact: ${recipient.recipientName}` : "Algemene mailbox",
    `Aanhef (gebruik exact): ${salutation}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSubjectOptions(company: Company, hiring: HiringIntelligenceProfile): string[] {
  const role = hiring.vacancyTitles[0] ?? hiring.signals[0]?.description?.slice(0, 40);
  if (role) {
    return [
      `${company.name} · hiring`,
      `Kort bellen — ${company.name}`,
      `Even sparren over werving`,
    ];
  }
  return [
    `Kennismaking — ${company.name}`,
    `${company.name} · recruitment`,
    `15 minuten — ${company.name}`,
  ];
}

function isGenericOpener(bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return GENERIC_OPENERS.some((phrase) => lower.includes(phrase));
}

function buildFallbackDraft(
  company: Company,
  recipient: DraftRecipient,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
): OutreachDraftContent {
  const analysis = analyzeBdOutreachContext(company, hiring, opportunity);
  const greeting = buildOutreachSalutation(
    recipient.recipientName,
    recipient.isGeneralMailbox,
    recipient.email,
  );

  const opener = buildVariedOpener(company, hiring, opportunity);
  const pain = buildPainLine(company, hiring, analysis);
  const hireFlow = buildHireFlowLine(analysis);
  const question = buildSimpleYesQuestion(company);

  const bodyText = truncateWords(
    [
      greeting,
      "",
      opener,
      "",
      pain,
      "",
      hireFlow,
      "",
      question,
      "",
      "Met vriendelijke groet,",
      "HireFlow Group",
    ].join("\n"),
    MAX_WORDS,
  );

  const warnings = hiring.warnings.length ? [...hiring.warnings] : [];
  if (hiring.signals.length === 0 && hiring.vacancyCount === 0) {
    warnings.push("beperkte personalisatie — weinig vacatures/signalen");
  }
  if (recipient.isGeneralMailbox) warnings.push("algemene mailbox — neutrale aanhef");

  const subjects = buildSubjectOptions(company, hiring);

  return outreachDraftContentSchema.parse({
    subjectOptions: subjects,
    recommendedSubject: subjects[0],
    bodyText,
    bodyHtml: null,
    personalizationSources: analysis.factsUsed,
    factualClaims: [
      analysis.whyAgency,
      analysis.likelyPain,
      ...hiring.explanations.slice(0, 1),
    ],
    warnings,
    confidence: hiring.signals.length > 0 || hiring.vacancyCount > 0 ? 0.78 : 0.45,
    bdAnalysis: analysis,
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

  const analysis = analyzeBdOutreachContext(company, hiring, opportunity);

  if (!isOpenAIConfigured()) {
    return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);
  }

  const salutation = buildOutreachSalutation(
    normalizedRecipient.recipientName,
    normalizedRecipient.isGeneralMailbox,
    normalizedRecipient.email,
  );

  const facts = buildFactsPayload(
    company,
    hiring,
    opportunity,
    normalizedRecipient,
    salutation,
    analysis,
  );

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: BD_CONSULTANT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `CONTEXT:\n${facts}\n\nJSON: { subjectOptions:[3 strings], recommendedSubject, bodyText, bodyHtml|null, personalizationSources[], factualClaims[], warnings[], confidence:0-1 }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.55,
      max_tokens: 900,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);

    const parsed = outreachDraftContentSchema.safeParse({
      ...JSON.parse(content),
      bdAnalysis: analysis,
    });
    if (!parsed.success) return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);

    let bodyText = parsed.data.bodyText;
    for (const phrase of BANNED_PHRASES) {
      if (bodyText.toLowerCase().includes(phrase)) {
        return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);
      }
    }

    if (isGenericOpener(bodyText)) {
      return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);
    }

    if (countWords(bodyText) > MAX_WORDS) {
      bodyText = truncateWords(bodyText, MAX_WORDS);
    }

    return { ...parsed.data, bodyText, bdAnalysis: analysis };
  } catch {
    return buildFallbackDraft(company, normalizedRecipient, hiring, opportunity);
  }
}

export async function generateRecruiterFollowUpDraft(
  company: Company,
  recipient: DraftRecipient | string | null,
  hiring: HiringIntelligenceProfile,
  previous: PreviousOutreachDraft,
): Promise<RecruiterFollowUpDraft> {
  const normalizedRecipient: DraftRecipient =
    typeof recipient === "string" || recipient === null
      ? {
          recipientName: recipient,
          email: company.hrEmail ?? company.email ?? "info@bedrijf.nl",
          isGeneralMailbox: !recipient,
        }
      : recipient;

  if (!isOpenAIConfigured()) {
    return buildFallbackFollowUp(company, normalizedRecipient, hiring, previous);
  }

  const salutation = buildOutreachSalutation(
    normalizedRecipient.recipientName,
    normalizedRecipient.isGeneralMailbox,
    normalizedRecipient.email,
  );

  const facts = [
    `Bedrijf: ${company.name}`,
    company.sector ? `Branche: ${company.sector}` : null,
    hiring.vacancyCount > 0 ? `Vacatures: ${hiring.vacancyCount}` : null,
    hiring.vacancyTitles.length ? `Vacaturetitels: ${hiring.vacancyTitles.join(", ")}` : null,
    `Eerdere mail onderwerp: ${previous.subject}`,
    `Eerdere mail inhoud (samenvatting): ${previous.bodyText.slice(0, 400)}`,
    `Aanhef (gebruik exact): ${salutation}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: FOLLOW_UP_SYSTEM_PROMPT },
        {
          role: "user",
          content: `CONTEXT:\n${facts}\n\nJSON: { subject, bodyText, warnings[], confidence:0-1 }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return buildFallbackFollowUp(company, normalizedRecipient, hiring, previous);
    }

    const parsed = JSON.parse(content) as Partial<RecruiterFollowUpDraft>;
    let bodyText = parsed.bodyText ?? "";
    let subject = parsed.subject ?? `Re: ${previous.subject}`;

    for (const phrase of FOLLOW_UP_BANNED_PHRASES) {
      if (bodyText.toLowerCase().includes(phrase)) {
        return buildFallbackFollowUp(company, normalizedRecipient, hiring, previous);
      }
    }

    if (!bodyText.trim()) {
      return buildFallbackFollowUp(company, normalizedRecipient, hiring, previous);
    }

    if (countWords(bodyText) > MAX_FOLLOW_UP_WORDS) {
      bodyText = truncateWords(bodyText, MAX_FOLLOW_UP_WORDS);
    }

    if (!subject.startsWith("Re:")) {
      subject = `Re: ${subject}`;
    }

    return {
      subject,
      bodyText,
      warnings: parsed.warnings ?? [],
      confidence: parsed.confidence ?? 0.7,
    };
  } catch {
    return buildFallbackFollowUp(company, normalizedRecipient, hiring, previous);
  }
}

export type DraftRewriteStyle = "rewrite" | "shorter" | "personal" | "formal" | "new_version";

const REWRITE_INSTRUCTIONS: Record<Exclude<DraftRewriteStyle, "new_version">, string> = {
  rewrite: "Herschrijf de mail volledig met dezelfde intentie maar andere formulering. Unieke opening.",
  shorter: `Maak de mail korter (max ${MAX_WORDS - 30} woorden). Behoud de kern en CTA.`,
  personal: "Maak de mail persoonlijker, warmer en menselijker — minder formeel, nog steeds professioneel.",
  formal: "Maak de mail formeler en zakelijker. Behoud personalisatie op basis van feiten.",
};

export async function rewriteRecruiterDraft(
  company: Company,
  recipient: DraftRecipient,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
  current: { subject: string; bodyText: string },
  style: DraftRewriteStyle,
): Promise<{ subject: string; bodyText: string }> {
  if (style === "new_version") {
    const draft = await generateRecruiterOutreachDraft(company, recipient, hiring, opportunity);
    return { subject: draft.recommendedSubject, bodyText: draft.bodyText };
  }

  if (!isOpenAIConfigured()) {
    return { subject: current.subject, bodyText: current.bodyText };
  }

  const instruction = REWRITE_INSTRUCTIONS[style];
  const salutation = buildOutreachSalutation(
    recipient.recipientName,
    recipient.isGeneralMailbox,
    recipient.email,
  );

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: BD_CONSULTANT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Bedrijf: ${company.name}`,
            instruction,
            `Aanhef (gebruik exact): ${salutation}`,
            `Huidig onderwerp: ${current.subject}`,
            `Huidige mail:\n${current.bodyText}`,
            "JSON: { subject, bodyText }",
          ].join("\n\n"),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { subject: current.subject, bodyText: current.bodyText };

    const parsed = JSON.parse(content) as { subject?: string; bodyText?: string };
    let bodyText = parsed.bodyText?.trim() || current.bodyText;
    const subject = parsed.subject?.trim() || current.subject;

    if (countWords(bodyText) > MAX_WORDS) {
      bodyText = truncateWords(bodyText, MAX_WORDS);
    }

    return { subject, bodyText };
  } catch {
    return { subject: current.subject, bodyText: current.bodyText };
  }
}

export { analyzeBdOutreachContext, pickVariantIndex } from "@/features/ai-recruiter/services/bd-outreach-analyzer.service";
