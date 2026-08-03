import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { NewVacancyClient } from "@/components/vacancies/new-vacancy-client";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { loadCompanyOptionsForUi } from "@/lib/vacancies/load-companies-for-ui";
import { authRoutes } from "@/config/navigation";

export const metadata: Metadata = {
  title: "Nieuwe vacature",
};

export default async function NewVacancyPage() {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    redirect(authRoutes.login);
  }

  const companies = await loadCompanyOptionsForUi(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nieuwe vacature"
        description="Registreer een vacature voor een bestaand bedrijf in je organisatie."
      />
      <NewVacancyClient companies={companies} />
    </div>
  );
}
