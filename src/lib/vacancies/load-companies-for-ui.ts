import { createCompaniesService } from "@/features/companies/create-companies-service";
import type { AuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import type { CompanyOption } from "@/components/vacancies/types";

export async function loadCompanyOptionsForUi(
  context: AuthenticatedServiceContext,
): Promise<CompanyOption[]> {
  const companiesService = await createCompaniesService();
  const { companies } = await companiesService.listCompanies(context, {
    limit: 100,
    includeArchived: false,
  });

  return companies.map((company) => ({
    id: company.id as string,
    name: company.name,
  }));
}
