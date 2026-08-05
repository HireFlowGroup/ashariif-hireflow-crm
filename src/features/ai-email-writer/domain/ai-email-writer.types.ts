export type AiEmailWriterStyle = "new_version" | "shorter" | "formal" | "personal";

export const MAX_EMAIL_WORDS = 170;

export type AiEmailWriterDraft = {
  subject: string;
  personalIntroduction: string;
  observedSituation: string;
  whyHireFlow: string;
  callToAction: string;
  closing: string;
  bodyText: string;
  wordCount: number;
};

export type AiEmailWriterContact = {
  name: string | null;
  jobTitle: string | null;
  email: string;
  isGeneralMailbox: boolean;
};

export type AiEmailWriterVacancy = {
  title: string;
  location: string | null;
  status: string;
};

export type AiEmailWriterCompany = {
  name: string;
  website: string | null;
  sector: string | null;
  city: string | null;
};

export type AiEmailWriterInput = {
  company: AiEmailWriterCompany;
  contact: AiEmailWriterContact;
  vacancies: AiEmailWriterVacancy[];
  /** Alleen feiten uit Recruitment Intelligence — verplicht voor generatie */
  analysisFacts: {
    company_summary: string;
    why_agency: string;
    likely_pain_points: string;
    why_hireflow: string;
    hard_to_fill_roles: string;
    urgency_rationale: string;
    opportunity_chance_rationale: string;
    likely_decision_maker: string;
    opening_line: string;
    recommended_cta: string;
    recruitment_opportunity_score: number | null;
    opportunity_tier: string | null;
  };
  salutation: string;
};
