/** Branded identifier for a company record within a tenant. */
export type CompanyId = string & { readonly __brand: "CompanyId" };

export function toCompanyId(value: string): CompanyId {
  return value as CompanyId;
}

export type CompanyStatus = "active" | "inactive" | "prospect" | "archived";

export type CompanyPriority = "low" | "medium" | "high";

export type LeadPriority = "A" | "B" | "C" | "D";

export type OutreachStatus = "none" | "queued" | "draft" | "review" | "sent" | "blocked";

export type HiringSignal = {
  type: string;
  description: string;
  source: string;
  confidence: number;
};

/** @deprecated Use LeadScoreComponents from lead-scoring feature */
export type ScoreBreakdown = {
  recruitmentActivity?: number;
  growth?: number;
  urgency?: number;
  contactability?: number;
  digitalPresence?: number;
  aiMatch?: number;
  outreachPotential?: number;
  sectorMatch?: number;
  regionMatch?: number;
  companySize?: number;
  activeVacancies?: number;
  relevantVacancies?: number;
  contactCompleteness?: number;
  sourceQuality?: number;
  crmStatus?: number;
  exclusionPenalty?: number;
};

export type Company = {
  id: CompanyId;
  organizationId: string;
  ownerId: string | null;
  name: string;
  website: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  sector: string | null;
  city: string | null;
  region: string | null;
  province: string | null;
  country: string | null;
  employeeCount: number | null;
  employeeCountMin: number | null;
  employeeCountMax: number | null;
  employeeCountLabel: string | null;
  priority: CompanyPriority | null;
  leadScore: number | null;
  leadPriority: LeadPriority | null;
  scoreReason: string | null;
  scoreBreakdown: ScoreBreakdown | null;
  vacancyCount: number;
  hiringSignals: HiringSignal[];
  careersUrl: string | null;
  vacancyPageUrl: string | null;
  generalEmail: string | null;
  hrEmail: string | null;
  kvkNumber: string | null;
  aiSummary: string | null;
  source: string | null;
  sourceUrl: string | null;
  confidence: number | null;
  companyType: string | null;
  companyConfidence: number | null;
  discoveryReason: string | null;
  discoveryProvider: string | null;
  lastVerifiedAt: string | null;
  outreachStatus: OutreachStatus;
  status: CompanyStatus;
  notes: string | null;
  outreachOptOut?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Input for creating a company (tenant context is applied in the service layer). */
export type CreateCompanyInput = {
  name: string;
  ownerId?: string | null;
  website?: string | null;
  domain?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  sector?: string | null;
  city?: string | null;
  region?: string | null;
  province?: string | null;
  country?: string | null;
  employeeCount?: number | null;
  employeeCountMin?: number | null;
  employeeCountMax?: number | null;
  employeeCountLabel?: string | null;
  priority?: CompanyPriority | null;
  leadScore?: number | null;
  leadPriority?: LeadPriority | null;
  scoreReason?: string | null;
  scoreBreakdown?: ScoreBreakdown | null;
  vacancyCount?: number;
  hiringSignals?: HiringSignal[];
  careersUrl?: string | null;
  vacancyPageUrl?: string | null;
  generalEmail?: string | null;
  hrEmail?: string | null;
  kvkNumber?: string | null;
  aiSummary?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  confidence?: number | null;
  companyType?: string | null;
  companyConfidence?: number | null;
  discoveryReason?: string | null;
  discoveryProvider?: string | null;
  lastVerifiedAt?: string | null;
  outreachStatus?: OutreachStatus;
  status?: CompanyStatus;
  notes?: string | null;
};

/** Partial update payload for an existing company. */
export type UpdateCompanyInput = {
  name?: string;
  ownerId?: string | null;
  website?: string | null;
  domain?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  sector?: string | null;
  city?: string | null;
  region?: string | null;
  province?: string | null;
  country?: string | null;
  employeeCount?: number | null;
  employeeCountMin?: number | null;
  employeeCountMax?: number | null;
  employeeCountLabel?: string | null;
  priority?: CompanyPriority | null;
  leadScore?: number | null;
  leadPriority?: LeadPriority | null;
  scoreReason?: string | null;
  scoreBreakdown?: ScoreBreakdown | null;
  vacancyCount?: number;
  hiringSignals?: HiringSignal[];
  careersUrl?: string | null;
  vacancyPageUrl?: string | null;
  generalEmail?: string | null;
  hrEmail?: string | null;
  kvkNumber?: string | null;
  aiSummary?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  confidence?: number | null;
  companyType?: string | null;
  companyConfidence?: number | null;
  discoveryReason?: string | null;
  discoveryProvider?: string | null;
  lastVerifiedAt?: string | null;
  outreachStatus?: OutreachStatus;
  status?: CompanyStatus;
  notes?: string | null;
};

export type ListCompaniesInput = {
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  leadPriority?: LeadPriority;
  hasVacancies?: boolean;
  outreachReady?: boolean;
};

export type SearchCompaniesInput = {
  query?: string;
  city?: string;
  sector?: string;
  archived?: boolean;
  status?: CompanyStatus;
  priority?: CompanyPriority;
  leadPriority?: LeadPriority;
  hasVacancies?: boolean;
  limit?: number;
};

/** Result of a paginated company list. */
export type ListCompaniesResult = {
  companies: Company[];
  total: number;
};

/** Input for archiving a company (reason is not persisted until notes column exists). */
export type ArchiveCompanyInput = {
  reason?: string;
};

/** Input for soft-deleting a company (reason is not persisted until notes column exists). */
export type DeleteCompanyInput = {
  reason?: string;
};
