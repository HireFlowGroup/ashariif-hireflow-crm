import type { Company } from "@/features/companies/domain";
import type { CompanyListItem } from "@/components/companies/types";

const statusLabels: Record<Company["status"], string> = {
  active: "Actief",
  inactive: "Inactief",
  prospect: "Prospect",
  archived: "Gearchiveerd",
};

export function formatCompanyStatus(status: Company["status"]): string {
  return statusLabels[status];
}

export function serializeCompanyForList(
  company: Company,
  contactCount = 0,
): CompanyListItem {
  return {
    id: company.id as string,
    name: company.name,
    city: company.city,
    sector: company.sector,
    status: company.status,
    website: company.website,
    updatedAt: company.updatedAt,
    contactCount,
    leadScore: company.leadScore,
    leadPriority: company.leadPriority,
    vacancyCount: company.vacancyCount,
    outreachStatus: company.outreachStatus,
    scoreReason: company.scoreReason,
  };
}

export function formatLeadPriority(priority: Company["leadPriority"]): string {
  if (!priority) return "—";
  return priority;
}

export function formatLeadScore(score: number | null): string {
  if (score === null) return "—";
  return String(score);
}
