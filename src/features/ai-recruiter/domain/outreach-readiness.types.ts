import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";

export type OutreachReadinessEvidence = {
  type: "vacancy" | "hiring_signal" | "careers_page" | "company_profile";
  claim: string;
  sourceUrl: string | null;
  sourceType: string;
  confidence: number;
};

export type OutreachReadinessResult = {
  ready: boolean;
  companyId: string;
  vacancyId: string | null;
  contactId: string | null;
  score: number;
  decision: string;
  recipientType: string;
  blockingReasons: string[];
  warnings: string[];
  evidence: OutreachReadinessEvidence[];
};

export type OutreachReadinessProspect = {
  companyId: string;
  vacancyId?: string | null;
  companyName: string;
  isCompetitor: boolean;
  isGenericIdentity: boolean;
  score: number;
  decision: string;
  threshold: number;
  eligible: boolean;
  contactEmail: string | null;
  contactId: string | null;
  isGeneralMailbox: boolean;
  contactVerificationStatus: string | null;
  duplicateOutreach: boolean;
  cooldownActive: boolean;
  suppressedContact: boolean;
  bouncedContact: boolean;
  invalidContact: boolean;
  hasVacancyEvidence: boolean;
  vacancies: VacancyEvidence[];
  hiringSignalCount: number;
  reasonCode: string;
  userMessage: string;
};
