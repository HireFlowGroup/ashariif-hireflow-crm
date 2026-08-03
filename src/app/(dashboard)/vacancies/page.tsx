import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VacanciesOverview } from "@/components/vacancies/vacancies-overview";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { loadCompanyOptionsForUi } from "@/lib/vacancies/load-companies-for-ui";
import { authRoutes } from "@/config/navigation";

export const metadata: Metadata = {
  title: "Vacatures",
};

export default async function VacanciesPage() {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    redirect(authRoutes.login);
  }

  const companies = await loadCompanyOptionsForUi(context);

  return <VacanciesOverview companies={companies} />;
}
