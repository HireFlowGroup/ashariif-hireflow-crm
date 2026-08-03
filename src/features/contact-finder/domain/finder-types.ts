/** Branded identifier for a contact discovery provider plugin. */
export type ContactFinderProviderId = string & {
  readonly __brand: "ContactFinderProviderId";
};

export function toContactFinderProviderId(value: string): ContactFinderProviderId {
  return value as ContactFinderProviderId;
}

export const DEFAULT_TARGET_ROLES = [
  "HR Manager",
  "Recruiter",
  "Talent Acquisition",
  "HR Business Partner",
  "Office Manager",
  "Directeur",
  "Eigenaar",
  "Managing Director",
] as const;

export type ContactFinderCriteria = {
  companyId: string;
  targetRoles: string[];
};

export type CompanyEnrichment = {
  website: string | null;
  linkedInCompanyUrl: string | null;
};

export type ExternalContactCandidate = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  source: ContactFinderProviderId;
  confidence: number;
  externalId: string;
  sourceUrl: string | null;
};

export type ContactSearchJobStatus = "pending" | "running" | "completed" | "failed";

export type ContactSearchJob = {
  id: string;
  organizationId: string;
  userId: string;
  companyId: string;
  status: ContactSearchJobStatus;
  criteria: ContactFinderCriteria;
  foundCount: number;
  savedCount: number;
  skippedCount: number;
  errorCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactFinderProgress = {
  phase:
    | "starting"
    | "enriching"
    | "searching"
    | "deduplicating"
    | "saving"
    | "complete";
  message: string;
  providerId?: ContactFinderProviderId;
  foundCount: number;
  savedCount: number;
  skippedCount: number;
  errorCount: number;
  progressPercent: number;
};
