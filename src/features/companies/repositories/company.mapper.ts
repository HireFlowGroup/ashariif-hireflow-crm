import type { Company as CompanyRow } from "@/types/crm";
import {
  type Company,
  type CompanyId,
  type CompanyStatus,
  toCompanyId,
} from "@/features/companies/domain";

const ROW_STATUSES = new Set(["active", "inactive", "prospect"]);

function toDomainStatus(status: CompanyRow["status"]): CompanyStatus {
  if (status === "inactive") {
    return "inactive";
  }

  if (status === "active") {
    return "active";
  }

  return "prospect";
}

/** Maps a Supabase companies row to the domain model. */
export function mapCompanyRowToDomain(
  row: CompanyRow,
  ownerId: string | null,
): Company {
  return {
    id: toCompanyId(row.id),
    organizationId: row.organization_id,
    ownerId,
    name: row.name,
    website: row.website,
    sector: row.industry,
    city: null,
    employeeCount: null,
    priority: null,
    status: toDomainStatus(row.status),
    notes: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CompanyInsertRow = {
  organization_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: CompanyRow["status"];
};

/** Maps create input to the current Supabase `companies` table shape. */
export function mapCreateInputToRow(
  organizationId: string,
  input: {
    name: string;
    website?: string | null;
    sector?: string | null;
    status?: CompanyStatus;
  },
): CompanyInsertRow {
  const status =
    input.status && ROW_STATUSES.has(input.status)
      ? (input.status as CompanyRow["status"])
      : "prospect";

  return {
    organization_id: organizationId,
    name: input.name,
    industry: input.sector ?? null,
    website: input.website ?? null,
    status,
  };
}

export type CompanyUpdateRow = Partial<
  Pick<CompanyInsertRow, "name" | "industry" | "website" | "status">
>;

export function mapUpdateInputToRow(input: {
  name?: string;
  website?: string | null;
  sector?: string | null;
  status?: CompanyStatus;
}): CompanyUpdateRow {
  const row: CompanyUpdateRow = {};

  if (input.name !== undefined) {
    row.name = input.name;
  }

  if (input.website !== undefined) {
    row.website = input.website;
  }

  if (input.sector !== undefined) {
    row.industry = input.sector;
  }

  if (input.status !== undefined && ROW_STATUSES.has(input.status)) {
    row.status = input.status as CompanyRow["status"];
  }

  return row;
}

export function mapCompanyIdToString(companyId: CompanyId): string {
  return companyId;
}
