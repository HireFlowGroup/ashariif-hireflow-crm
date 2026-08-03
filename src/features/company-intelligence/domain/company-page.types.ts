import type { Company } from "@/features/companies/domain";
import type { LeadPriority } from "@/features/lead-scoring/domain/lead-score.types";
import type { PriorityComponents, PriorityProfile } from "@/features/priority-engine";
import type { ContactListItem } from "@/lib/contacts/format";

export type CompanyDigitalPresence = {
  website: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  careersUrl: string | null;
  vacancyPageUrl: string | null;
  atsDetected: boolean;
  atsProviders: string[];
  technologies: string[];
};

export type CompanyHiringSignalItem = {
  id: string;
  type: string;
  typeLabel: string;
  title: string | null;
  description: string | null;
  source: string | null;
  sourceUrl: string | null;
  confidence: number | null;
  importance: number;
  observedAt: string;
};

export type CompanyVacancyItem = {
  id: string;
  title: string;
  status: string;
  location: string | null;
  employmentType: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanyOutreachItem = {
  id: string;
  status: string;
  suggestedContactRole: string | null;
  outreachAngle: string | null;
  messageSubject: string | null;
  messageBody: string | null;
  reviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

export type CompanyOutreachIntelligence = {
  id: string;
  outreachId: string | null;
  recommendedContactId: string | null;
  recommendedContactName: string | null;
  recommendedContactRole: string | null;
  contactScore: number;
  contactReason: string | null;
  recommendedChannel: "email" | "linkedin" | "phone";
  channelScores: { email: number; linkedin: number; phone: number };
  channelReason: string | null;
  recommendedMomentAt: string | null;
  recommendedMomentLabel: string | null;
  timingReason: string | null;
  outreachScore: number;
  responseProbability: number;
  draftSubject: string | null;
  draftBody: string | null;
  followUpSubject: string | null;
  followUpBody: string | null;
  followUpScheduledAt: string | null;
  model: string | null;
  computedAt: string;
};

export type CompanyTaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueAt: string | null;
  createdAt: string;
};

export type CompanyTimelineEvent = {
  id: string;
  type: "signal" | "vacancy" | "outreach" | "task" | "company" | "contact";
  title: string;
  description: string | null;
  occurredAt: string;
  meta?: string | null;
  href?: string | null;
};

export type CompanyActivityItem = {
  id: string;
  type: CompanyTimelineEvent["type"];
  title: string;
  description: string | null;
  occurredAt: string;
  href?: string | null;
};

export type CompanyNewsItem = {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  observedAt: string;
};

export type CompanyPageIntelligence = {
  currentScore: number | null;
  currentPriority: LeadPriority | null;
  scoreReason: string | null;
  aiSummary: string | null;
  hiringIntensity: number;
  signalCount: number;
  lastSignalAt: string | null;
  outreachStatus: string | null;
};

export type CompanyPageData = {
  company: Company;
  intelligence: CompanyPageIntelligence;
  scoreComponents: PriorityComponents | null;
  priorityProfile: PriorityProfile | null;
  scoreExplanation: string | null;
  digitalPresence: CompanyDigitalPresence;
  hiringSignals: CompanyHiringSignalItem[];
  news: CompanyNewsItem[];
  vacancies: CompanyVacancyItem[];
  contacts: ContactListItem[];
  outreachHistory: CompanyOutreachItem[];
  outreachIntelligence: CompanyOutreachIntelligence | null;
  openTasks: CompanyTaskItem[];
  timeline: CompanyTimelineEvent[];
  activity: CompanyActivityItem[];
  generatedAt: string;
};
