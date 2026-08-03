import type { PriorityComponentKey } from "@/features/priority-engine/config/priority-engine.config";

export type LeadPriority = "A" | "B" | "C" | "D";

export type PriorityFactor = {
  label: string;
  points: number;
};

export type PriorityComponents = Record<PriorityComponentKey, number>;

export type PriorityComponentDetail = {
  key: PriorityComponentKey;
  label: string;
  score: number;
  weight: number;
  weightedContribution: number;
  factors: PriorityFactor[];
  /** For inverted axes (e.g. outreach difficulty) — score used in composite. */
  effectiveScore: number;
};

export type PriorityProfile = {
  compositeScore: number;
  priority: LeadPriority;
  components: PriorityComponents;
  details: PriorityComponentDetail[];
  summary: string;
  modelVersion: string;
  computedAt: string;
};

export type PriorityInputContact = {
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  confidence: number | null;
};

export type PriorityInput = {
  name: string;
  sector: string | null;
  city: string | null;
  region: string | null;
  website: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  email: string | null;
  generalEmail: string | null;
  hrEmail: string | null;
  phone: string | null;
  careersUrl: string | null;
  vacancyPageUrl: string | null;
  kvkNumber: string | null;
  vacancyCount: number;
  vacancyTitles: string[];
  hiringSignals: Array<{
    type: string;
    description: string;
    confidence: number;
    importance?: number;
  }>;
  hiringIntensity?: number;
  signalCount?: number;
  confidence: number;
  outreachStatus?: string | null;
  contactCount?: number;
  contacts?: PriorityInputContact[];
  source: string | null;
  criteria?: {
    sector?: string;
    city?: string;
    region?: string;
    keywords?: string;
    employeeCountMin?: number;
    employeeCountMax?: number;
  };
};

export type PriorityBreakdownPayload = {
  version: string;
  components: PriorityComponents;
  factors: Record<PriorityComponentKey, PriorityFactor[]>;
  weighted: Array<{
    key: PriorityComponentKey;
    rawScore: number;
    effectiveScore: number;
    weight: number;
    weightedScore: number;
  }>;
  compositeScore: number;
  priority: LeadPriority;
  summary: string;
};

export function priorityFromScore(
  score: number,
  thresholds: { A: number; B: number; C: number },
): LeadPriority {
  if (score >= thresholds.A) return "A";
  if (score >= thresholds.B) return "B";
  if (score >= thresholds.C) return "C";
  return "D";
}

export function priorityColorClass(priority: LeadPriority): string {
  switch (priority) {
    case "A":
      return "text-emerald-600";
    case "B":
      return "text-sky-600";
    case "C":
      return "text-amber-600";
    default:
      return "text-muted-foreground";
  }
}
