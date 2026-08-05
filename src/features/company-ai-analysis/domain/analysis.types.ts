export type CompanyAnalysisSections = {
  summary: string;
  recruitmentSituation: string;
  recruitmentPotential: string;
  recruitmentPotentialMotivation: string;
  growth: string;
  challenges: string;
  outreachAdvice: string;
  likelyDecisionMaker: string;
  suitableRoles: string;
  likelyAts: string;
  competitors: string;
  topHiringSignal: string;
};

export type CompanyAnalysisSectionKey = keyof CompanyAnalysisSections;

export const COMPANY_ANALYSIS_SECTION_LABELS: Record<CompanyAnalysisSectionKey, string> = {
  summary: "Samenvatting",
  recruitmentSituation: "Recruitment situatie",
  recruitmentPotential: "Recruitment Potential",
  recruitmentPotentialMotivation: "Motivatie",
  growth: "Groei",
  challenges: "Mogelijke uitdagingen",
  outreachAdvice: "Outreach advies",
  likelyDecisionMaker: "Waarschijnlijk besluitvormer",
  suitableRoles: "Geschikte functies",
  likelyAts: "Waarschijnlijke ATS",
  competitors: "Concurrenten",
  topHiringSignal: "Belangrijkste hiring signal",
};

export type CompanyAnalysisRecord = {
  id: string;
  companyId: string;
  sections: CompanyAnalysisSections;
  model: string | null;
  generatedAt: string;
  dataFingerprint: string;
};

export type CompanyAnalysisResponse = {
  analysis: CompanyAnalysisRecord | null;
  isStale: boolean;
  generatedAt: string;
};

export type CompanyAnalysisContextSignal = {
  id: string;
  type: string;
  typeLabel: string;
  title: string | null;
  description: string | null;
  source: string | null;
  sourceUrl: string | null;
  confidence: number | null;
  importance: number;
  aiRelevance: number;
  observedAt: string;
  provider: string;
};

export type CompanyAnalysisContextContact = {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  confidence: number | null;
};

export type CompanyAnalysisContextVacancy = {
  id: string;
  title: string;
  status: string;
  location: string | null;
  source: string | null;
};

export type CompanyAnalysisContextSimilarCompany = {
  id: string;
  name: string;
  sector: string | null;
  city: string | null;
  score: number | null;
  hiringIntensity: number;
  similarityReasons: string[];
};

export type CompanyAnalysisContext = {
  organizationId: string;
  companyId: string;
  companyName: string;
  sector: string | null;
  city: string | null;
  region: string | null;
  website: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  careersUrl: string | null;
  vacancyPageUrl: string | null;
  leadScore: number | null;
  leadPriority: string | null;
  scoreReason: string | null;
  hiringIntensity: number;
  signalCount: number;
  lastSignalAt: string | null;
  atsProviders: string[];
  atsDetected: boolean;
  signals: CompanyAnalysisContextSignal[];
  vacancies: CompanyAnalysisContextVacancy[];
  contacts: CompanyAnalysisContextContact[];
  similarCompanies: CompanyAnalysisContextSimilarCompany[];
  outreachRecommendedContact: string | null;
  outreachRecommendedRole: string | null;
  outreachAngle: string | null;
  dataFingerprint: string;
};
