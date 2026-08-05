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
