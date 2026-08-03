import type { Vacancy as VacancyRow } from "@/types/crm";
import { toCompanyId } from "@/features/companies/domain";
import {
  type EmploymentType,
  type Vacancy,
  type VacancyId,
  type VacancyStatus,
  toVacancyId,
} from "@/features/vacancies/domain";

const ROW_STATUSES = new Set(["draft", "open", "on_hold", "closed"]);

function toDomainStatus(status: VacancyRow["status"]): VacancyStatus {
  return status;
}

function toDomainEmploymentType(type: VacancyRow["employment_type"]): EmploymentType {
  return type;
}

/** Maps a Supabase vacancies row to the domain model. */
export function mapVacancyRowToDomain(row: VacancyRow): Vacancy {
  return {
    id: toVacancyId(row.id),
    organizationId: row.organization_id,
    companyId: toCompanyId(row.company_id),
    ownerId: row.owner_id ?? null,
    title: row.title,
    description: row.description ?? null,
    location: row.location,
    employmentType: toDomainEmploymentType(row.employment_type),
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    status: toDomainStatus(row.status),
    requirements: row.requirements ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type VacancyInsertRow = {
  organization_id: string;
  company_id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: VacancyRow["employment_type"];
  salary_min: number | null;
  salary_max: number | null;
  status: VacancyRow["status"];
  requirements: string | null;
};

export function mapCreateInputToRow(
  organizationId: string,
  input: {
    companyId: string;
    ownerId: string | null;
    title: string;
    description?: string | null;
    location?: string | null;
    employmentType?: EmploymentType;
    salaryMin?: number | null;
    salaryMax?: number | null;
    status?: VacancyStatus;
    requirements?: string | null;
  },
): VacancyInsertRow {
  const status =
    input.status && ROW_STATUSES.has(input.status)
      ? input.status
      : "draft";

  return {
    organization_id: organizationId,
    company_id: input.companyId,
    owner_id: input.ownerId,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    employment_type: input.employmentType ?? "full_time",
    salary_min: input.salaryMin ?? null,
    salary_max: input.salaryMax ?? null,
    status,
    requirements: input.requirements ?? null,
  };
}

export type VacancyUpdateRow = Partial<
  Omit<VacancyInsertRow, "organization_id">
>;

export function mapUpdateInputToRow(input: {
  companyId?: string;
  ownerId?: string | null;
  title?: string;
  description?: string | null;
  location?: string | null;
  employmentType?: EmploymentType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  status?: VacancyStatus;
  requirements?: string | null;
}): VacancyUpdateRow {
  const row: VacancyUpdateRow = {};

  if (input.companyId !== undefined) {
    row.company_id = input.companyId;
  }

  if (input.ownerId !== undefined) {
    row.owner_id = input.ownerId;
  }

  if (input.title !== undefined) {
    row.title = input.title;
  }

  if (input.description !== undefined) {
    row.description = input.description;
  }

  if (input.location !== undefined) {
    row.location = input.location;
  }

  if (input.employmentType !== undefined) {
    row.employment_type = input.employmentType;
  }

  if (input.salaryMin !== undefined) {
    row.salary_min = input.salaryMin;
  }

  if (input.salaryMax !== undefined) {
    row.salary_max = input.salaryMax;
  }

  if (input.status !== undefined && ROW_STATUSES.has(input.status)) {
    row.status = input.status;
  }

  if (input.requirements !== undefined) {
    row.requirements = input.requirements;
  }

  return row;
}

export function mapVacancyIdToString(vacancyId: VacancyId): string {
  return vacancyId;
}
