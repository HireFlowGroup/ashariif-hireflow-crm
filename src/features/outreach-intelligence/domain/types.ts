export type OutreachChannel = "email" | "linkedin" | "phone";

export type OutreachChannelScores = {
  email: number;
  linkedin: number;
  phone: number;
};

export type OutreachContactCandidate = {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  confidence: number | null;
  score: number;
  reasons: string[];
};

export type OutreachScoreBreakdown = {
  leadScore: number;
  contactFit: number;
  signalRecency: number;
  channelFit: number;
  hiringIntensity: number;
  contactAvailability: number;
};

export type OutreachIntelligenceRecord = {
  id: string;
  organizationId: string;
  companyId: string;
  outreachId: string | null;

  recommendedContactId: string | null;
  recommendedContactName: string | null;
  recommendedContactRole: string | null;
  contactScore: number;
  contactReason: string | null;

  recommendedChannel: OutreachChannel;
  channelScores: OutreachChannelScores;
  channelReason: string | null;

  recommendedMomentAt: string | null;
  recommendedMomentLabel: string | null;
  timingReason: string | null;

  outreachScore: number;
  responseProbability: number;
  scoreBreakdown: OutreachScoreBreakdown;

  draftSubject: string | null;
  draftBody: string | null;
  followUpSubject: string | null;
  followUpBody: string | null;
  followUpScheduledAt: string | null;

  hiringSignalId: string | null;
  aiSummaryId: string | null;

  model: string | null;
  computedAt: string;
};

export type OutreachIntelligenceContext = {
  organizationId: string;
  userId: string;
  companyId: string;
  companyName: string;
  sector: string | null;
  city: string | null;
  website: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  leadScore: number | null;
  leadPriority: string | null;
  hiringIntensity: number;
  signalCount: number;
  lastSignalAt: string | null;
  aiSummary: string | null;
  vacancyCount: number;
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    linkedinUrl: string | null;
    confidence: number | null;
  }>;
  signals: Array<{
    id: string;
    signalType: string;
    title: string | null;
    description: string | null;
    observedAt: string;
    importance: number;
  }>;
  vacancies: Array<{
    id: string;
    title: string;
    createdAt: string;
  }>;
};

export type GenerateOutreachIntelligenceResult = {
  intelligence: OutreachIntelligenceRecord;
  outreachId: string | null;
};
