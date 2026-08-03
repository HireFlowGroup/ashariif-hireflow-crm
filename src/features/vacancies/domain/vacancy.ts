import type { CompanyId } from "@/features/companies/domain";

/** Branded identifier for a vacancy record within a tenant. */
export type VacancyId = string & { readonly __brand: "VacancyId" };

export function toVacancyId(value: string): VacancyId {
  return value as VacancyId;
}

export type VacancyStatus = "draft" | "open" | "on_hold" | "closed";

export type EmploymentType = "full_time" | "part_time" | "contract" | "temporary";

export type Vacancy = {
  id: VacancyId;
  organizationId: string;
  companyId: CompanyId;
  ownerId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  status: VacancyStatus;
  requirements: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateVacancyInput = {
  companyId: CompanyId;
  title: string;
  ownerId?: string | null;
  description?: string | null;
  location?: string | null;
  employmentType?: EmploymentType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  status?: VacancyStatus;
  requirements?: string | null;
};

export type UpdateVacancyInput = {
  companyId?: CompanyId;
  title?: string;
  ownerId?: string | null;
  description?: string | null;
  location?: string | null;
  employmentType?: EmploymentType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  status?: VacancyStatus;
  requirements?: string | null;
};

export type SearchVacanciesInput = {
  query?: string;
  companyId?: CompanyId;
  location?: string;
  employmentType?: EmploymentType;
  status?: VacancyStatus;
  archived?: boolean;
  limit?: number;
};

export type ListVacanciesInput = {
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  companyId?: CompanyId;
};

export type ListVacanciesResult = {
  vacancies: Vacancy[];
  total: number;
};

export type ArchiveVacancyInput = {
  reason?: string;
};
