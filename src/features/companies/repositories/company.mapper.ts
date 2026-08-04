import type { Company as CompanyRow } from "@/types/crm";
import {
  type Company,
  type CompanyId,
  type CompanyStatus,
  type HiringSignal,
  type LeadPriority,
  type OutreachStatus,
  type ScoreBreakdown,
  toCompanyId,
} from "@/features/companies/domain";
import {
  toDbCompanyStatus,
  toDomainCompanyStatus,
} from "@/features/companies/repositories/company-status.mapper";

function toDomainStatus(status: CompanyRow["status"]): CompanyStatus {
  return toDomainCompanyStatus(status);
}

type CompanyRowExtended = CompanyRow & {
  sector?: string | null;
  owner_id?: string | null;
  user_id?: string | null;
  domain?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  country?: string | null;
  employee_count_min?: number | null;
  employee_count_max?: number | null;
  source?: string | null;
  source_url?: string | null;
  confidence?: number | null;
  company_type?: string | null;
  company_confidence?: number | null;
  discovery_reason?: string | null;
  discovery_provider?: string | null;
  lead_score?: number | null;
  priority?: LeadPriority | null;
  score_reason?: string | null;
  score_breakdown?: ScoreBreakdown | null;
  vacancy_count?: number | null;
  hiring_signals?: HiringSignal[] | null;
  last_verified_at?: string | null;
  outreach_status?: OutreachStatus | null;
  province?: string | null;
  careers_url?: string | null;
  vacancy_page_url?: string | null;
  general_email?: string | null;
  hr_email?: string | null;
  kvk_number?: string | null;
  ai_summary?: string | null;
};

export function mapCompanyRowToDomain(
  row: CompanyRow,
  ownerId: string | null,
): Company {
  const extended = row as CompanyRowExtended;

  return {
    id: toCompanyId(row.id),
    organizationId: row.organization_id ?? "",
    ownerId: ownerId ?? extended.owner_id ?? null,
    name: row.name,
    website: row.website ?? null,
    domain: extended.domain ?? null,
    linkedinUrl: extended.linkedin_url ?? null,
    email: extended.email ?? null,
    phone: extended.phone ?? null,
    sector: extended.sector ?? row.industry ?? null,
    city: row.city ?? null,
    region: extended.region ?? null,
    province: extended.province ?? extended.region ?? null,
    country: extended.country ?? "NL",
    employeeCount: extended.employee_count_min ?? null,
    employeeCountMin: extended.employee_count_min ?? null,
    employeeCountMax: extended.employee_count_max ?? null,
    employeeCountLabel: null,
    priority: null,
    leadScore: extended.lead_score ?? null,
    leadPriority: extended.priority ?? null,
    scoreReason: extended.score_reason ?? null,
    scoreBreakdown: extended.score_breakdown ?? null,
    vacancyCount: extended.vacancy_count ?? 0,
    hiringSignals: extended.hiring_signals ?? [],
    careersUrl: extended.careers_url ?? null,
    vacancyPageUrl: extended.vacancy_page_url ?? null,
    generalEmail: extended.general_email ?? null,
    hrEmail: extended.hr_email ?? null,
    kvkNumber: extended.kvk_number ?? null,
    aiSummary: extended.ai_summary ?? null,
    source: extended.source ?? null,
    sourceUrl: extended.source_url ?? null,
    confidence: extended.confidence ?? null,
    companyType: extended.company_type ?? null,
    companyConfidence: extended.company_confidence ?? null,
    discoveryReason: extended.discovery_reason ?? null,
    discoveryProvider: extended.discovery_provider ?? null,
    lastVerifiedAt: extended.last_verified_at ?? null,
    outreachStatus: extended.outreach_status ?? "none",
    status: toDomainStatus(row.status),
    notes: null,
    outreachOptOut: Boolean((row as { outreach_opt_out?: boolean }).outreach_opt_out),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export type CompanyInsertRow = Record<string, unknown>;

type LeadFieldsInput = {
  name: string;
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
  employeeCountMin?: number | null;
  employeeCountMax?: number | null;
  employeeCountLabel?: string | null;
  careersUrl?: string | null;
  vacancyPageUrl?: string | null;
  generalEmail?: string | null;
  hrEmail?: string | null;
  kvkNumber?: string | null;
  aiSummary?: string | null;
  leadScore?: number | null;
  leadPriority?: LeadPriority | null;
  scoreReason?: string | null;
  scoreBreakdown?: ScoreBreakdown | null;
  vacancyCount?: number;
  hiringSignals?: HiringSignal[];
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
  ownerId?: string | null;
  notes?: string | null;
};

export function mapDiscoveryCreateInputToRow(
  organizationId: string,
  input: LeadFieldsInput & { notes?: string | null },
): CompanyInsertRow {
  const sector = input.sector ?? null;

  return {
    organization_id: organizationId,
    name: input.name,
    industry: sector,
    sector,
    city: input.city ?? null,
    region: input.region ?? null,
    province: input.province ?? input.region ?? null,
    website: input.website ?? null,
    domain: input.domain ?? null,
    source: input.source ?? "tavily",
    source_url: input.sourceUrl ?? null,
    confidence: input.confidence ?? null,
    company_type: input.companyType ?? null,
    company_confidence: input.companyConfidence ?? null,
    discovery_reason: input.discoveryReason ?? null,
    discovery_provider: input.discoveryProvider ?? null,
    status: toDbCompanyStatus(input.status ?? "prospect"),
    owner_id: input.ownerId ?? null,
    notes: input.notes ?? null,
  };
}

/** Bare-minimum insert when extended columns are missing in the database. */
export function mapBareDiscoveryCreateInputToRow(
  organizationId: string,
  input: Pick<LeadFieldsInput, "name" | "website" | "sector" | "status">,
): CompanyInsertRow {
  return {
    organization_id: organizationId,
    name: input.name,
    industry: input.sector ?? null,
    website: input.website ?? null,
    status: toDbCompanyStatus(input.status ?? "prospect"),
  };
}

export function mapCreateInputToRow(
  organizationId: string,
  input: LeadFieldsInput,
): CompanyInsertRow {
  const status = toDbCompanyStatus(input.status ?? "prospect");
  const sector = input.sector ?? null;

  return {
    organization_id: organizationId,
    name: input.name,
    industry: sector,
    sector,
    city: input.city ?? null,
    region: input.region ?? null,
    province: input.province ?? input.region ?? null,
    country: input.country ?? "NL",
    website: input.website ?? null,
    domain: input.domain ?? null,
    linkedin_url: input.linkedinUrl ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    employee_count_min: input.employeeCountMin ?? null,
    employee_count_max: input.employeeCountMax ?? null,
    source: input.source ?? null,
    source_url: input.sourceUrl ?? null,
    confidence: input.confidence ?? null,
    lead_score: input.leadScore ?? null,
    priority: input.leadPriority ?? null,
    score_reason: input.scoreReason ?? null,
    score_breakdown: input.scoreBreakdown ?? null,
    vacancy_count: input.vacancyCount ?? 0,
    hiring_signals: input.hiringSignals ?? [],
    careers_url: input.careersUrl ?? null,
    vacancy_page_url: input.vacancyPageUrl ?? null,
    general_email: input.generalEmail ?? null,
    hr_email: input.hrEmail ?? null,
    kvk_number: input.kvkNumber ?? null,
    ai_summary: input.aiSummary ?? null,
    last_verified_at: input.lastVerifiedAt ?? null,
    outreach_status: input.outreachStatus ?? "none",
    status,
    owner_id: input.ownerId ?? null,
    notes: input.notes ?? null,
  };
}

export function mapUpdateInputToRow(input: Partial<LeadFieldsInput>): CompanyInsertRow {
  const row: CompanyInsertRow = {};

  if (input.name !== undefined) row.name = input.name;
  if (input.website !== undefined) row.website = input.website;
  if (input.domain !== undefined) row.domain = input.domain;
  if (input.linkedinUrl !== undefined) row.linkedin_url = input.linkedinUrl;
  if (input.email !== undefined) row.email = input.email;
  if (input.phone !== undefined) row.phone = input.phone;
  if (input.sector !== undefined) {
    row.industry = input.sector;
    row.sector = input.sector;
  }
  if (input.city !== undefined) row.city = input.city;
  if (input.region !== undefined) row.region = input.region;
  if (input.province !== undefined) row.province = input.province;
  if (input.careersUrl !== undefined) row.careers_url = input.careersUrl;
  if (input.vacancyPageUrl !== undefined) row.vacancy_page_url = input.vacancyPageUrl;
  if (input.generalEmail !== undefined) row.general_email = input.generalEmail;
  if (input.hrEmail !== undefined) row.hr_email = input.hrEmail;
  if (input.kvkNumber !== undefined) row.kvk_number = input.kvkNumber;
  if (input.aiSummary !== undefined) row.ai_summary = input.aiSummary;
  if (input.leadScore !== undefined) row.lead_score = input.leadScore;
  if (input.leadPriority !== undefined) row.priority = input.leadPriority;
  if (input.scoreReason !== undefined) row.score_reason = input.scoreReason;
  if (input.scoreBreakdown !== undefined) row.score_breakdown = input.scoreBreakdown;
  if (input.vacancyCount !== undefined) row.vacancy_count = input.vacancyCount;
  if (input.hiringSignals !== undefined) row.hiring_signals = input.hiringSignals;
  if (input.source !== undefined) row.source = input.source;
  if (input.sourceUrl !== undefined) row.source_url = input.sourceUrl;
  if (input.confidence !== undefined) row.confidence = input.confidence;
  if (input.lastVerifiedAt !== undefined) row.last_verified_at = input.lastVerifiedAt;
  if (input.outreachStatus !== undefined) row.outreach_status = input.outreachStatus;

  if (input.status !== undefined) {
    row.status = toDbCompanyStatus(input.status);
  }

  return row;
}

export function mapCompanyIdToString(companyId: CompanyId): string {
  return companyId;
}

/** Only fill empty existing fields — never overwrite with null/empty. */
export function mergeLeadFields(
  existing: Company,
  incoming: Partial<LeadFieldsInput>,
): Partial<LeadFieldsInput> {
  const merged: Partial<LeadFieldsInput> = {};

  if (!existing.website && incoming.website) merged.website = incoming.website;
  if (!existing.domain && incoming.domain) merged.domain = incoming.domain;
  if (!existing.email && incoming.email) merged.email = incoming.email;
  if (!existing.phone && incoming.phone) merged.phone = incoming.phone;
  if (!existing.city && incoming.city) merged.city = incoming.city;
  if (!existing.region && incoming.region) merged.region = incoming.region;
  if (!existing.sector && incoming.sector) merged.sector = incoming.sector;
  if (!existing.linkedinUrl && incoming.linkedinUrl) merged.linkedinUrl = incoming.linkedinUrl;
  if (!existing.careersUrl && incoming.careersUrl) merged.careersUrl = incoming.careersUrl;
  if (!existing.vacancyPageUrl && incoming.vacancyPageUrl) merged.vacancyPageUrl = incoming.vacancyPageUrl;
  if (!existing.generalEmail && incoming.generalEmail) merged.generalEmail = incoming.generalEmail;
  if (!existing.hrEmail && incoming.hrEmail) merged.hrEmail = incoming.hrEmail;
  if (!existing.kvkNumber && incoming.kvkNumber) merged.kvkNumber = incoming.kvkNumber;
  if (!existing.aiSummary && incoming.aiSummary) merged.aiSummary = incoming.aiSummary;

  if (incoming.leadScore !== undefined && incoming.leadScore !== null && (existing.leadScore === null || incoming.leadScore > existing.leadScore)) {
    merged.leadScore = incoming.leadScore;
    merged.leadPriority = incoming.leadPriority;
    merged.scoreReason = incoming.scoreReason;
    merged.scoreBreakdown = incoming.scoreBreakdown;
  }

  if (incoming.vacancyCount !== undefined && incoming.vacancyCount > existing.vacancyCount) {
    merged.vacancyCount = incoming.vacancyCount;
  }

  if (incoming.hiringSignals?.length && incoming.hiringSignals.length > existing.hiringSignals.length) {
    merged.hiringSignals = incoming.hiringSignals;
  }

  if (!existing.source && incoming.source) merged.source = incoming.source;
  if (!existing.sourceUrl && incoming.sourceUrl) merged.sourceUrl = incoming.sourceUrl;

  if (incoming.confidence !== undefined && incoming.confidence !== null && (existing.confidence === null || incoming.confidence > existing.confidence)) {
    merged.confidence = incoming.confidence;
  }

  if (incoming.lastVerifiedAt) merged.lastVerifiedAt = incoming.lastVerifiedAt;

  return merged;
}
