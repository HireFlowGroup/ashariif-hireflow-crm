import "server-only";

import type { Company } from "@/features/companies/domain";
import type { OutreachDraftContent } from "@/features/ai-recruiter/domain/types";
import { outreachDraftContentSchema } from "@/features/ai-recruiter/domain/types";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { buildOutreachSalutation } from "@/features/contact-finder/services/contact-validation.service";
import { isOpenAIConfigured } from "@/platform/config/env";
import { getOpenAIClient } from "@/lib/ai/client";

const MAX_WORDS = 180;
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
];

const COPYWRITER_SYSTEM_PROMPT = `Je bent de beste B2B copywriter gespecialiseerd in recruitment, en schrijft alsof een ervaren recruiter de mail zelf heeft getypt.

Schrijf GEEN standaard acquisitiemail. Schrijf een persoonlijke introductie in het Nederlands.

Gebruik ALLEEN feiten uit de context (vacatures, bedrijf, branche, groei, hiring signalen). Verzin niets.

STRUCTUUR (in vloeiende proza, geen bullets):
1. Open met iets specifieks over dit bedrijf
2. Toon begrip voor hun situatie (hiringdruk, groei, parallelle vacatures)
3. Leg kort uit hoe HireFlow Group helpt — praktisch, nuchter, geen verkooppraat
4. Vraag om een vrijblijvende kennismaking

REGELS:
- Maximaal ${MAX_WORDS} woorden in bodyText
- Geen hype, geen superlatieven, geen druk
- Geen kandidaten aanbieden zonder toestemming
- Gebruik exact de opgegeven aanhef
- Bij algemene mailbox: neutrale HR/recruitment-toon
- Vermijd: ${BANNED_PHRASES.join(", ")}
- Ondertekening: "Met vriendelijke groet,\\nHireFlow Group"
- subjectOptions: 3 korte, menselijke onderwerpregels (geen sales)`;

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
  "ik wilde even",
  "even follow-up",
  "laatste kans",
  "mis niet",
  "dringend",
  "nu nog",
  "alleen vandaag",
  "steeds geen reactie",
  "hopelijk leest u",
];

const FOLLOW_UP_SYSTEM_PROMPT = `Je bent een Senior Sales Consultant bij HireFlow Group.
Schrijf een follow-up e-mail in het Nederlands — vriendelijk professioneel, nooit opdringerig.

STRUCTUUR:
1. Verwijs kort naar je eerdere mail (onderwerp of inhoud)
2. Herhaal kort waarom HireFlow kan helpen (praktisch, nuchter)
3. Eén duidelijke vraag of actie — geen meerdere opties

REGELS:
- Maximaal ${MAX_FOLLOW_UP_WORDS} woorden in bodyText
- NOOIT: "ik wilde even", druk uitoefenen, meerdere CTAs, schuldgevoel opwekken
- Geen hype of superlatieven
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

function buildSpecificOpener(
  company: Company,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
): string {
  const roles = opportunity.rolesSought.slice(0, 2);
  if (roles.length > 0 && hiring.vacancyCount > 0) {
    return `Ik zag dat ${company.name} momenteel onder andere zoekt naar ${roles.join(" en ")}.`;
  }

  if (hiring.vacancyCount >= 2) {
    return `Ik zag dat ${company.name} meerdere vacatures open heeft staan${company.city ? ` (${company.city})` : ""}.`;
  }

  if (hiring.vacancyCount === 1 && hiring.vacancyTitles[0]) {
    return `Ik zag de vacature voor ${hiring.vacancyTitles[0]} bij ${company.name}.`;
  }

  const growthSignal = hiring.signals.find(
    (s) => isGrowthSignal(s.description ?? "") || isGrowthSignal(s.type),
  );
  if (growthSignal?.description) {
    return `Ik las recent over ${company.name}: ${growthSignal.description.charAt(0).toLowerCase()}${growthSignal.description.slice(1).replace(/\.$/, "")}.`;
  }

  const topSignal = hiring.signals[0]?.description;
  if (topSignal) {
    return `Ik kwam ${company.name} tegen naar aanleiding van ${topSignal.charAt(0).toLowerCase()}${topSignal.slice(1).replace(/\.$/, "")}.`;
  }

  if (company.sector) {
    return `Ik nam ${company.name} door — een organisatie in ${company.sector}${company.city ? ` (${company.city})` : ""}.`;
  }

  return `Ik wilde even contact opnemen over de hiring-situatie bij ${company.name}.`;
}

function buildUnderstandingParagraph(
  company: Company,
  hiring: HiringIntelligenceProfile,
  opportunity: OpportunityAssessment,
): string {
  const parts: string[] = [];

  if (company.sector) {
    parts.push(`In ${company.sector} zie je vaak dat werving meeloopt met groei`);
  } else {
    parts.push("Bij groeiende teams merk ik dat werving erbij komt");
  }

  if (hiring.vacancyCount >= 2) {
    parts.push("zeker wanneer meerdere rollen tegelijk openstaan");
  } else if (opportunity.urgency === "high") {
    parts.push("vooral wanneer vacatures langer open blijven staan");
  }

  parts.push("terwijl interne capaciteit niet altijd meeschaalt");

  return `${parts.join(", ").replace(/, ([^,]*)$/, " en $1")}. Dat herken ik.`;
}

function buildHireFlowParagraph(): string {
  return "Bij HireFlow Group helpen we organisaties met flexibele recruitment-ondersteuning: meedenken over werving, schalen wanneer het druk wordt — zonder vaste FTE of ingewikkelde trajecten.";
}

function buildHireFlowFollowUpLine(): string {
  return "HireFlow Group ondersteunt teams met flexibele recruitment-capaciteit — meedenken en opschalen wanneer interne werving krap wordt.";
}

function buildPreviousMailReference(company: Company, previous: PreviousOutreachDraft): string {
  const topic = previous.subject.replace(/^Re:\s*/i, "").trim();
  if (topic && topic !== company.name) {
    return `In mijn eerdere mail over ${topic} ging het om de hiring-situatie bij ${company.name}.`;
  }
  return `In mijn eerdere bericht over de hiring-situatie bij ${company.name} wilde ik kort terugkomen.`;
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
      "Staat u open voor een kort gesprek van 15 minuten?",
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
    hiring.vacancyCount > 0 ? `Vacatures: ${hiring.vacancyCount}` : "Geen vacatures in data",
    hiring.vacancyTitles.length ? `Vacaturetitels: ${hiring.vacancyTitles.join(", ")}` : null,
    opportunity.rolesSought.length ? `Gezochte functies: ${opportunity.rolesSought.join(", ")}` : null,
    growthSignals.length ? `Groei/uitbreiding: ${growthSignals.join("; ")}` : null,
    hiring.signals.length
      ? `Hiring signalen:\n${hiring.signals.slice(0, 5).map((s) => `- ${s.description ?? s.title}`).join("\n")}`
      : null,
    opportunity.why.length ? `Context: ${opportunity.why.slice(0, 3).join("; ")}` : null,
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
      `Kennismaking — ${company.name}`,
      `${company.name} · hiring`,
      `Even sparren over werving`,
    ];
  }
  return [
    `Kennismaking — ${company.name}`,
    `Even bellen over recruitment`,
    `${company.name} · hiring`,
  ];
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

  const opener = buildSpecificOpener(company, hiring, opportunity);
  const understanding = buildUnderstandingParagraph(company, hiring, opportunity);
  const help = buildHireFlowParagraph();

  const bodyText = truncateWords(
    [
      greeting,
      "",
      opener,
      "",
      understanding,
      "",
      help,
      "",
      "Staat u open voor een vrijblijvende kennismaking? Dan hoor ik graag hoe u het nu aanpakt.",
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
    personalizationSources: [
      company.name,
      company.sector,
      company.city,
      ...hiring.signals.slice(0, 2).map((s) => s.description ?? s.title),
      ...opportunity.rolesSought.slice(0, 2),
    ].filter(Boolean) as string[],
    factualClaims: [
      ...hiring.explanations.slice(0, 2),
      ...opportunity.why.slice(0, 2),
    ],
    warnings,
    confidence: hiring.signals.length > 0 || hiring.vacancyCount > 0 ? 0.78 : 0.45,
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

  const facts = buildFactsPayload(company, hiring, opportunity, normalizedRecipient, salutation);

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: COPYWRITER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `CONTEXT:\n${facts}\n\nJSON: { subjectOptions:[3 strings], recommendedSubject, bodyText, bodyHtml|null, personalizationSources[], factualClaims[], warnings[], confidence:0-1 }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 900,
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
