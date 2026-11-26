import type { Company } from "@/features/companies/domain";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { PersonalizationFact } from "@/features/ai-recruiter/services/recruitment-outreach-writer.service";
import { buildOutreachSalutation } from "@/features/contact-finder/services/contact-validation.service";
import {
  filterStrictVacancyEvidence,
  strictVacancyEvidence,
} from "@/features/ai-recruiter/services/vacancy-evidence.service";

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
  blocked: boolean;
  blockReason: string | null;
};

export function buildDeterministicOutreachFallback(
  input: DeterministicFallbackInput,
): DeterministicFallbackDraft {
  const salutation = buildOutreachSalutation(
    input.recipientName,
    input.isGeneralMailbox,
    input.recipientEmail,
  );

  const strictVacancies = filterStrictVacancyEvidence(input.vacancies);
  const primary = strictVacancies[0];

  if (!primary || !strictVacancyEvidence(primary)) {
    return {
      subject: "",
      salutation,
      bodyText: "",
      cta: "",
      closing: "",
      personalizationFacts: [],
      sourceEvidence: [],
      warnings: ["blocked_no_vacancy_evidence_for_hiring_claim"],
      blocked: true,
      blockReason: "Geen concrete vacature-evidence voor recruitmentclaim.",
    };
  }

  const vacancyTitle = primary.jobTitle;
  const facts: PersonalizationFact[] = [
    {
      claim: `Ik zag dat jullie momenteel een ${vacancyTitle} zoeken.`,
      sourceUrl: primary.jobUrl,
      sourceType: "vacancy",
      confidence: 0.95,
    },
  ];

  const subject = `${input.company.name} · ${vacancyTitle}`;
  const cta =
    "Zou het passen als wij op basis van deze vacature vrijblijvend een paar geschikte profielen voor u selecteren?";
  const support =
    "HireFlow Group ondersteunt organisaties bij het vinden en selecteren van geschikte professionals.";
  const sender = input.senderName ?? "HireFlow Group";
  const closing = `Met vriendelijke groet,\n\n${sender}\nHireFlow Group`;

  const bodyText = truncateWords(
    [salutation, "", facts[0]!.claim, "", support, "", cta, "", closing].join("\n"),
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
    blocked: false,
    blockReason: null,
  };
}

export function isFallbackWithinWordLimit(bodyText: string): boolean {
  return countWords(bodyText) <= MAX_FALLBACK_WORDS;
}
