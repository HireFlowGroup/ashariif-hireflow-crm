import "server-only";

import type { Company } from "@/features/companies/domain";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import {
  analyzeBdOutreachContext,
  pickVariantIndex,
} from "@/features/ai-recruiter/services/bd-outreach-analyzer.service";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import {
  buildOutreachSalutation,
  type SelectedDiscoveredContact,
} from "@/features/contact-finder/services/contact-validation.service";
import { isOpenAIConfigured } from "@/platform/config/env";
import { getOpenAIClient } from "@/lib/ai/client";

import {
  RECRUITMENT_OUTREACH_PROMPT_VERSION,
  MAX_RECRUITMENT_OUTREACH_WORDS,
  type DraftVariantType,
} from "@/features/ai-recruiter/domain/recruitment-outreach.types";

export type PersonalizationFact = {
  claim: string;
  sourceUrl: string | null;
  sourceType: string;
  confidence: number;
};

export type RecruitmentOutreachDraftInput = {
  company: Company;
  vacancy?: { id: string; title: string } | null;
  hiringSignals: HiringIntelligenceProfile;
  companyAnalysis?: OpportunityAssessment | null;
  selectedContact: {
    email: string;
    recipientName: string | null;
    isGeneralMailbox: boolean;
    jobTitle?: string | null;
    reliability?: SelectedDiscoveredContact["reliability"];
  };
  opportunityScore: number;
  previousOutreach?: { subject: string; bodyText: string } | null;
  senderProfile?: { name: string; email: string } | null;
  language?: "nl";
  tone?: "professional" | "direct" | "formal" | "personal";
  vacancies?: VacancyEvidence[];
};

export type RecruitmentOutreachDraft = {
  subject: string;
  salutation: string;
  body: string;
  cta: string;
  closing: string;
  personalizationFacts: PersonalizationFact[];
  sourceEvidence: PersonalizationFact[];
  warnings: string[];
  confidence: number;
  model: string;
  promptVersion: string;
  bodyText: string;
  recommendedSubject: string;
};

const PERMISSION_CTAS = [
  "Staat u ervoor open dat wij vrijblijvend geschikte kandidaten voor deze vacature zoeken en aan u voorstellen?",
  "Mag ik voor deze vacature een korte selectie van geschikte kandidaten met u delen?",
  "Zou het passen als wij op basis van deze vacature een paar geschikte profielen voor u selecteren?",
];

const BANNED_CLAIMS = [
  "wij hebben dé kandidaat",
  "wij hebben al kandidaten",
  "kandidaat beschikbaar",
  "perfecte kandidaat",
  "direct beschikbaar",
];

const RECRUITMENT_WRITER_SYSTEM = `Je schrijft Nederlandse acquisitiemails voor HireFlow Group.
Doel: toestemming krijgen om kandidaten te zoeken voor een open vacature (permission_to_source_candidates).

REGELS:
- Maximaal ${MAX_RECRUITMENT_OUTREACH_WORDS} woorden in body
- Nederlands, professioneel en menselijk
- Eén concrete vacature of hiring need noemen
- Maximaal twee personalisatiefacts op basis van context
- Geen buzzwords, geen verzonnen prestaties
- NOOIT beweren dat er al kandidaten beschikbaar zijn
- Geen lange introductie over HireFlow
- Gebruik exact de opgegeven aanhef
- Eén eenvoudige CTA: vraag toestemming om kandidaten te zoeken/voorstellen
- Ondertekening: "Met vriendelijke groet,\\nHireFlow Group"

STRUCTUUR:
1. Gepersonaliseerde openingszin
2. Concrete vacature of hiring need
3. Korte uitleg hoe HireFlow kan ondersteunen
4. Vraag om toestemming om kandidaten te zoeken
5. Afsluiting`;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

function firstNameReliable(
  recipientName: string | null,
  reliability?: SelectedDiscoveredContact["reliability"],
): boolean {
  if (!recipientName?.trim()) return false;
  const first = recipientName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const blocked = new Set(["contact", "team", "hr", "recruitment", "—", "-", "onbekend"]);
  if (blocked.has(first)) return false;
  return (reliability?.level ?? "low") !== "low";
}

function buildPersonalizationFacts(
  company: Company,
  hiring: HiringIntelligenceProfile,
  vacancies: VacancyEvidence[],
): PersonalizationFact[] {
  const facts: PersonalizationFact[] = [];

  const primaryVacancy = vacancies[0];
  if (primaryVacancy) {
    facts.push({
      claim: `Jullie zoeken momenteel een ${primaryVacancy.title}.`,
      sourceUrl: primaryVacancy.sourceUrl,
      sourceType: "vacancy",
      confidence: primaryVacancy.isActive ? 0.97 : 0.75,
    });
  } else if (hiring.vacancyTitles[0]) {
    facts.push({
      claim: `Jullie zoeken momenteel een ${hiring.vacancyTitles[0]}.`,
      sourceUrl: company.website ?? null,
      sourceType: "vacancy",
      confidence: 0.8,
    });
  }

  if (hiring.vacancyCount >= 2) {
    facts.push({
      claim: `${company.name} heeft ${hiring.vacancyCount} vacatures open staan.`,
      sourceUrl: company.website ?? null,
      sourceType: "careers_page",
      confidence: 0.85,
    });
  }

  const signal = hiring.signals[0];
  if (signal && facts.length < 2) {
    facts.push({
      claim: signal.description ?? signal.title,
      sourceUrl: company.website ?? null,
      sourceType: "hiring_signal",
      confidence: 0.7,
    });
  }

  return facts.slice(0, 2);
}

function buildPermissionCta(company: Company, vacancyTitle: string | null): string {
  if (vacancyTitle) {
    const withRole = PERMISSION_CTAS.map((cta) =>
      cta.replace("deze vacature", `de vacature ${vacancyTitle}`),
    );
    return withRole[pickVariantIndex(company.id ?? company.name, withRole.length)]!;
  }
  return PERMISSION_CTAS[pickVariantIndex(company.id ?? company.name, PERMISSION_CTAS.length)]!;
}

function buildSupportLine(): string {
  return "HireFlow Group helpt teams met het vinden en voorstellen van geschikte kandidaten — zonder verplichting toteen opdracht.";
}

function buildFallbackDraft(input: RecruitmentOutreachDraftInput): RecruitmentOutreachDraft {
  const { company, hiringSignals: hiring, selectedContact, vacancies = [] } = input;
  const opportunity: OpportunityAssessment =
    input.companyAnalysis ?? {
      rolesSought: hiring.vacancyTitles,
      why: [],
      urgency: "medium",
      bestApproach: "",
      recruitmentPotential: "MEDIUM",
      recruitmentPotentialMotivation: "",
      opportunityScore: input.opportunityScore,
      agencyNeedLikelihood: "medium",
      breakdown: {
        growth: 0,
        multipleVacancies: 0,
        noInternalRecruiter: 0,
        staleVacancies: 0,
        scalability: 0,
      },
    };

  const facts = buildPersonalizationFacts(company, hiring, vacancies);
  const vacancyTitle = vacancies[0]?.title ?? hiring.vacancyTitles[0] ?? null;

  const salutation = buildOutreachSalutation(
    selectedContact.recipientName,
    selectedContact.isGeneralMailbox,
    selectedContact.email,
    {
      firstNameReliable: firstNameReliable(selectedContact.recipientName, selectedContact.reliability),
    },
  );

  const opener =
    facts[0]?.claim
    ?? `${company.name} lijkt actief te werven — daarom neem ik contact op.`;

  const cta = buildPermissionCta(company, vacancyTitle);
  const support = buildSupportLine();

  const bodyParts = [salutation, "", opener, "", support, "", cta, "", "Met vriendelijke groet,", "HireFlow Group"];
  const bodyText = truncateWords(bodyParts.join("\n"), MAX_RECRUITMENT_OUTREACH_WORDS);

  const warnings: string[] = [];
  if (facts.length === 0) warnings.push("insufficient_personalization_evidence");
  if (selectedContact.isGeneralMailbox) warnings.push("algemene mailbox — neutrale aanhef");

  const subjectOptions = vacancyTitle
    ? [`${company.name} · ${vacancyTitle}`, `Kandidaten voor ${vacancyTitle}`, `Vraag — ${company.name}`]
    : [`${company.name} · recruitment`, `Kandidaten zoeken — ${company.name}`, `Vraag — ${company.name}`];

  const subject = subjectOptions[0]!;

  return {
    subject,
    salutation,
    body: bodyText,
    cta,
    closing: "Met vriendelijke groet,\nHireFlow Group",
    personalizationFacts: facts,
    sourceEvidence: facts,
    warnings,
    confidence: facts.length > 0 ? 0.78 : 0.45,
    model: "fallback",
    promptVersion: RECRUITMENT_OUTREACH_PROMPT_VERSION,
    bodyText,
    recommendedSubject: subject,
  };
}

function containsBannedClaims(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_CLAIMS.some((phrase) => lower.includes(phrase));
}

function containsPermissionIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("kandidaten")
    && (lower.includes("zoeken") || lower.includes("voorstellen") || lower.includes("delen") || lower.includes("selectie"))
  );
}

export async function generateRecruitmentOutreachDraft(
  input: RecruitmentOutreachDraftInput,
): Promise<RecruitmentOutreachDraft> {
  const { company, hiringSignals: hiring, selectedContact, vacancies = [] } = input;
  const facts = buildPersonalizationFacts(company, hiring, vacancies);
  const vacancyTitle = vacancies[0]?.title ?? hiring.vacancyTitles[0] ?? null;

  const salutation = buildOutreachSalutation(
    selectedContact.recipientName,
    selectedContact.isGeneralMailbox,
    selectedContact.email,
    {
      firstNameReliable: firstNameReliable(selectedContact.recipientName, selectedContact.reliability),
    },
  );

  const fallback = buildFallbackDraft(input);

  if (!isOpenAIConfigured()) {
    return fallback;
  }

  const analysis = analyzeBdOutreachContext(
    company,
    hiring,
    input.companyAnalysis ?? {
      rolesSought: hiring.vacancyTitles,
      why: [],
      urgency: "medium",
      bestApproach: "",
      recruitmentPotential: "MEDIUM",
      recruitmentPotentialMotivation: "",
      opportunityScore: input.opportunityScore,
      agencyNeedLikelihood: "medium",
      breakdown: {
        growth: 0,
        multipleVacancies: 0,
        noInternalRecruiter: 0,
        staleVacancies: 0,
        scalability: 0,
      },
    },
  );

  const contextLines = [
    `Bedrijf: ${company.name}`,
    company.sector ? `Sector: ${company.sector}` : null,
    company.city ? `Locatie: ${company.city}` : null,
    vacancyTitle ? `Vacature: ${vacancyTitle}` : null,
    hiring.vacancyCount > 0 ? `Aantal vacatures: ${hiring.vacancyCount}` : null,
    facts.length ? `Feiten:\n${facts.map((f) => `- ${f.claim}`).join("\n")}` : null,
    `Aanhef (exact gebruiken): ${salutation}`,
    `CTA-voorbeeld: ${buildPermissionCta(company, vacancyTitle)}`,
    `Analyse: ${analysis.whyHireFlow}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: RECRUITMENT_WRITER_SYSTEM },
        {
          role: "user",
          content: `${contextLines}\n\nJSON: { subject, bodyText, cta, warnings[], confidence:0-1 }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.45,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as {
      subject?: string;
      bodyText?: string;
      cta?: string;
      warnings?: string[];
      confidence?: number;
    };

    let bodyText = parsed.bodyText?.trim() ?? "";
    const cta = parsed.cta?.trim() ?? buildPermissionCta(company, vacancyTitle);

    if (!bodyText || containsBannedClaims(bodyText) || !containsPermissionIntent(bodyText + " " + cta)) {
      return fallback;
    }

    if (!bodyText.startsWith(salutation.replace(",", "")) && !bodyText.includes(salutation)) {
      bodyText = `${salutation}\n\n${bodyText}`;
    }

    if (!bodyText.includes(cta.slice(0, 20))) {
      bodyText = `${bodyText}\n\n${cta}`;
    }

    if (!bodyText.includes("Met vriendelijke groet")) {
      bodyText = `${bodyText}\n\nMet vriendelijke groet,\nHireFlow Group`;
    }

    if (countWords(bodyText) > MAX_RECRUITMENT_OUTREACH_WORDS) {
      bodyText = truncateWords(bodyText, MAX_RECRUITMENT_OUTREACH_WORDS);
    }

    const warnings = [...(parsed.warnings ?? [])];
    if (facts.length === 0) warnings.push("insufficient_personalization_evidence");

    return {
      subject: parsed.subject?.trim() || fallback.subject,
      salutation,
      body: bodyText,
      cta,
      closing: "Met vriendelijke groet,\nHireFlow Group",
      personalizationFacts: facts,
      sourceEvidence: facts,
      warnings,
      confidence: parsed.confidence ?? 0.75,
      model: "gpt-4o-mini",
      promptVersion: RECRUITMENT_OUTREACH_PROMPT_VERSION,
      bodyText,
      recommendedSubject: parsed.subject?.trim() || fallback.subject,
    };
  } catch {
    return fallback;
  }
}

export type { DraftVariantType } from "@/features/ai-recruiter/domain/recruitment-outreach.types";
export {
  RECRUITMENT_OUTREACH_PROMPT_VERSION,
  MAX_RECRUITMENT_OUTREACH_WORDS,
} from "@/features/ai-recruiter/domain/recruitment-outreach.types";

const VARIANT_TONE: Record<Exclude<DraftVariantType, "default">, RecruitmentOutreachDraftInput["tone"]> = {
  shorter: "direct",
  personal: "personal",
  formal: "formal",
  direct: "direct",
};

export async function generateRecruitmentOutreachVariant(
  input: RecruitmentOutreachDraftInput,
  variant: DraftVariantType,
  parentDraft?: RecruitmentOutreachDraft,
): Promise<RecruitmentOutreachDraft> {
  if (variant === "default") {
    return generateRecruitmentOutreachDraft(input);
  }

  const tone = VARIANT_TONE[variant];
  const draft = await generateRecruitmentOutreachDraft({ ...input, tone });

  if (variant === "shorter" && countWords(draft.bodyText) > 90) {
    draft.bodyText = truncateWords(draft.bodyText, 90);
    draft.body = draft.bodyText;
    draft.warnings.push("variant_shorter");
  }

  if (parentDraft) {
    draft.warnings.push(`parent_draft:${parentDraft.promptVersion}`);
  }

  return draft;
}

export function countRecruitmentOutreachWords(text: string): number {
  return countWords(text);
}
