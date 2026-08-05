export const INSUFFICIENT_DATA = "Onvoldoende informatie." as const;

/** @deprecated Use INSUFFICIENT_DATA — kept for legacy JSON in DB */
export const LEGACY_INSUFFICIENT_DATA = "Onvoldoende data." as const;

export type RecruitmentOpportunityTier = "warm" | "interessant" | "lage_kans";

export type RecruitmentIntelligenceAnalysis = {
  /** Korte bedrijfscontext op basis van feiten */
  company_summary: string;
  /** Waarom zou dit bedrijf een recruitmentbureau inschakelen? */
  why_agency: string;
  /** Welke pijn ervaren zij waarschijnlijk? */
  likely_pain_points: string;
  /** Waarom zouden ze HireFlow kiezen? */
  why_hireflow: string;
  /** Welke functies zijn het moeilijkst te vervullen? */
  hard_to_fill_roles: string;
  /** Hoe dringend is hun behoefte? (tekst) */
  urgency_rationale: string;
  /** Wat is de kans op een opdracht? (tekst) */
  opportunity_chance_rationale: string;
  /** Welke contactpersoon heeft de meeste beslissingsbevoegdheid? */
  likely_decision_maker: string;
  /** Wat is de beste openingszin? */
  opening_line: string;
  /** Wat is de beste CTA? */
  recommended_cta: string;
  /** Urgentie 0-100 — null bij onvoldoende data */
  urgency_score: number | null;
  /** Recruitment Opportunity Score 0-100 — null bij onvoldoende data */
  recruitment_opportunity_score: number | null;
  /** Afgeleid van recruitment_opportunity_score */
  opportunity_tier: RecruitmentOpportunityTier | null;
};

export type RecruitmentIntelligenceVacancy = {
  id: string;
  title: string;
  status: string;
  location: string | null;
  createdAt: string | null;
};

export type RecruitmentIntelligenceSignal = {
  id: string;
  type: string;
  typeLabel: string;
  title: string | null;
  description: string | null;
  source: string | null;
  observedAt: string | null;
  confidence: number | null;
};

export type RecruitmentIntelligenceContact = {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  linkedinUrl: string | null;
  confidence: number | null;
};

export type RecruitmentIntelligenceInput = {
  organizationId: string;
  companyId: string;
  runItemId: string | null;
  companyName: string;
  website: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  sector: string | null;
  city: string | null;
  region: string | null;
  employeeLabel: string | null;
  vacancies: RecruitmentIntelligenceVacancy[];
  signals: RecruitmentIntelligenceSignal[];
  contacts: RecruitmentIntelligenceContact[];
  inputFingerprint: string;
};

export type RecruitmentIntelligenceRecord = {
  id: string;
  organizationId: string;
  companyId: string;
  runItemId: string | null;
  analysis: RecruitmentIntelligenceAnalysis;
  inputFingerprint: string;
  model: string | null;
  opportunityScore: number | null;
  opportunityTier: RecruitmentOpportunityTier | null;
  generatedAt: string;
};
