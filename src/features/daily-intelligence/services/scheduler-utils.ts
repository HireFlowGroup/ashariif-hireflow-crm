import type { Company } from "@/features/companies/domain";
import type { CollectSignalsCriteria } from "@/features/hiring-intelligence/domain/signal-types";

export function buildCompanyRefreshCriteria(company: Company): CollectSignalsCriteria {
  return {
    companyName: company.name,
    website: company.website,
    domain: company.domain,
    linkedinUrl: company.linkedinUrl,
    city: company.city ?? undefined,
    region: company.region ?? company.province ?? undefined,
    sector: company.sector ?? undefined,
    maxResults: 8,
  };
}

export function buildCompanyHintFromCompany(company: Company) {
  return {
    name: company.name,
    normalizedName: company.name.toLowerCase().replace(/\s+/g, " ").trim(),
    website: company.website,
    domain: company.domain,
    linkedinUrl: company.linkedinUrl,
    city: company.city,
    region: company.region ?? company.province,
    sector: company.sector,
  };
}

export function isSignalRelevantToCompany(
  signal: { title: string; description: string; url: string | null; companyHint?: { name?: string; domain?: string | null } | null },
  company: Company,
): boolean {
  const normalizedCompany = company.name.toLowerCase().replace(/\s+/g, " ").trim();
  const haystack = `${signal.title} ${signal.description} ${signal.url ?? ""} ${signal.companyHint?.name ?? ""}`.toLowerCase();

  if (haystack.includes(normalizedCompany)) return true;

  if (company.domain && haystack.includes(company.domain.toLowerCase())) return true;

  if (company.website) {
    try {
      const host = new URL(company.website.startsWith("http") ? company.website : `https://${company.website}`).hostname;
      if (haystack.includes(host.replace(/^www\./, ""))) return true;
    } catch {
      // ignore invalid URL
    }
  }

  if (signal.companyHint?.domain && company.domain) {
    return signal.companyHint.domain.toLowerCase() === company.domain.toLowerCase();
  }

  return false;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createWorkerId(): string {
  return `worker-${process.pid}-${Date.now().toString(36)}`;
}
