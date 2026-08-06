import type { Company } from "@/features/companies/domain";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { PersonalizationFact } from "@/features/ai-recruiter/services/recruitment-outreach-writer.service";
import { buildOutreachSalutation } from "@/features/contact-finder/services/contact-validation.service";

const MAX_FALLBACK_WORDS = 120;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

export type DeterministicFallbackInput = {
  company: Company;
  vacancies: VacancyEvidence[];
  recipientEmail: string;
  recipientName: string | null;
  isGeneralMailbox: boolean;
  senderName?: string;
};

export type DeterministicFallbackDraft = {
  subject: string;
  salutation: string;
  bodyText: string;
  cta: string;
  closing: string;
  personalizationFacts: PersonalizationFact[];
  sourceEvidence: PersonalizationFact[];
  warnings: string[];
};

export function buildDeterministicOutreachFallback(
  input: DeterministicFallbackInput,
): DeterministicFallbackDraft {
  const vacancyTitle = input.vacancies[0]?.title ?? "recruitmentfunctie";
  const salutation = buildOutreachSalutation(
    input.recipientName,
    input.isGeneralMailbox,
    input.recipientEmail,
  );

  const facts: PersonalizationFact[] = [];
  if (input.vacancies[0]) {
    facts.push({
      claim: `${input.company.name} heeft momenteel ${vacancyTitle} open staan.`,
      sourceUrl: input.vacancies[0].sourceUrl,
      sourceType: "vacancy",
      confidence: input.vacancies[0].isActive ? 0.9 : 0.7,
    });
  }

  const subject = "Ondersteuning bij jullie recruitmentvacature";
  const cta =
    "Staat u ervoor open dat wij vrijblijvend geschikte kandidaten voor deze vacature zoeken en aan u voorstellen?";
  const support =
    "HireFlow Group ondersteunt organisaties bij het vinden en selecteren van geschikte professionals voor moeilijk vervulbare functies.";
  const opener = facts[0]?.claim ?? `Ik zag dat ${input.company.name} momenteel actief werft.`;

  const sender = input.senderName ?? "HireFlow Group";
  const closing = `Met vriendelijke groet,\n\n${sender}\nHireFlow Group`;

  const bodyText = truncateWords(
    [salutation, "", opener, "", support, "", cta, "", closing].join("\n"),
    MAX_FALLBACK_WORDS,
  );

  return {
    subject,
    salutation,
    bodyText,
    cta,
    closing,
    personalizationFacts: facts,
    sourceEvidence: facts,
    warnings: ["ai_generation_failed_fallback_used"],
  };
}

export function isFallbackWithinWordLimit(bodyText: string): boolean {
  return countWords(bodyText) <= MAX_FALLBACK_WORDS;
}
