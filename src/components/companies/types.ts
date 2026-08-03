import type { CompanyStatus } from "@/features/companies/domain";
import type { LeadPriority } from "@/features/companies/domain";

export type CompanyListItem = {
  id: string;
  name: string;
  city: string | null;
  sector: string | null;
  status: CompanyStatus;
  website: string | null;
  updatedAt: string;
  contactCount: number;
  leadScore: number | null;
  leadPriority: LeadPriority | null;
  vacancyCount: number;
  outreachStatus: string;
  scoreReason: string | null;
};

export type CompanyListFilters = {
  leadPriority?: LeadPriority;
  hasVacancies?: boolean;
  outreachReady?: boolean;
};
