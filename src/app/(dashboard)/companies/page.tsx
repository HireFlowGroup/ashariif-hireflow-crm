import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompaniesPageClient } from "@/components/companies/companies-page-client";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import { createContactsService } from "@/features/contacts/create-contacts-service";
import type { CompanyListFilters } from "@/components/companies/types";
import type { LeadPriority } from "@/features/companies/domain";
import { mapLoaderErrorToMessage } from "@/lib/contacts/api-errors";
import { CompaniesRepositoryError } from "@/features/companies/repositories/errors";
import { serializeCompanyForList } from "@/lib/companies/format";
import { authRoutes } from "@/config/navigation";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Bedrijven",
};

type CompaniesPageProps = {
  searchParams: Promise<{
    priority?: string;
    vacancies?: string;
    outreach?: string;
  }>;
};

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(authRoutes.login);
  }

  const profile = await getSessionProfile();
  const params = await searchParams;

  const filters: CompanyListFilters = {
    leadPriority: ["A", "B", "C", "D"].includes(params.priority ?? "")
      ? (params.priority as LeadPriority)
      : undefined,
    hasVacancies: params.vacancies === "1",
    outreachReady: params.outreach === "1",
  };

  if (!profile) {
    return (
      <CompaniesPageClient
        companies={[]}
        total={0}
        errorMessage="Je profiel kon niet worden geladen. Neem contact op met een beheerder."
        initialFilters={filters}
      />
    );
  }

  const context = {
    userId: user.id,
    organizationId: profile.organization_id,
  };

  let companies: ReturnType<typeof serializeCompanyForList>[] = [];
  let total = 0;
  let errorMessage: string | null = null;

  try {
    const companiesService = await createCompaniesService();
    const contactsService = await createContactsService();
    const result = await companiesService.listCompanies(context, {
      limit: 100,
      includeArchived: false,
      leadPriority: filters.leadPriority,
      hasVacancies: filters.hasVacancies,
      outreachReady: filters.outreachReady,
    });

    const companyIds = result.companies.map((company) => company.id as string);
    const countByCompanyId = new Map<string, number>();

    try {
      const contactCounts = await contactsService.countContactsByCompanyIds(
        context,
        companyIds,
      );

      for (const entry of contactCounts) {
        countByCompanyId.set(entry.companyId, entry.count);
      }
    } catch {
      for (const companyId of companyIds) {
        countByCompanyId.set(companyId, 0);
      }
    }

    companies = result.companies.map((company) =>
      serializeCompanyForList(company, countByCompanyId.get(company.id as string) ?? 0),
    );
    total = result.total;
  } catch (error) {
    console.error("[companies/page] Laden mislukt", {
      userId: user.id,
      organizationId: profile.organization_id,
      error: error instanceof Error ? error.message : "Onbekende fout",
      supabaseCode:
        error instanceof CompaniesRepositoryError ? error.supabaseCode : undefined,
    });
    errorMessage = mapLoaderErrorToMessage(error);
  }

  return (
    <CompaniesPageClient
      companies={companies}
      total={total}
      errorMessage={errorMessage}
      initialFilters={filters}
    />
  );
}
