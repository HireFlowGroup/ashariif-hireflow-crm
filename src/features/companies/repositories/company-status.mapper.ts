import type { CompanyStatus } from "@/features/companies/domain";

/** Legacy NL CRM statuses stored in production Supabase. */
export const LEGACY_CRM_DB_STATUSES = [
  "Nieuw",
  "Gemaild",
  "Reactie",
  "Gesprek",
  "Offerte",
  "Klant",
] as const;

export type LegacyCrmDbStatus = (typeof LEGACY_CRM_DB_STATUSES)[number];

export type CompanyDbStatus =
  | LegacyCrmDbStatus
  | "active"
  | "inactive"
  | "prospect";

const LEGACY_CRM_SET = new Set<string>(LEGACY_CRM_DB_STATUSES);

/** Map domain status → Postgres `companies.status` value. */
export function toDbCompanyStatus(status?: CompanyStatus | null): CompanyDbStatus {
  switch (status) {
    case "active":
      return "Klant";
    case "archived":
    case "inactive":
      return "inactive";
    case "prospect":
    default:
      return "Nieuw";
  }
}

/** Map Postgres row status → domain status. */
export function toDomainCompanyStatus(status: string | null | undefined): CompanyStatus {
  if (!status) return "prospect";

  if (status === "active" || status === "Klant") return "active";
  if (status === "inactive") return "archived";
  if (status === "prospect") return "prospect";
  if (LEGACY_CRM_SET.has(status)) return "prospect";

  return "prospect";
}
