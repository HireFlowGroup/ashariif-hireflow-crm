import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EditVacancyClient } from "@/components/vacancies/edit-vacancy-client";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { loadCompanyOptionsForUi } from "@/lib/vacancies/load-companies-for-ui";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { toVacancyId } from "@/features/vacancies/domain";
import { VacanciesValidationError } from "@/features/vacancies/services/errors";
import { authRoutes } from "@/config/navigation";

export const metadata: Metadata = {
  title: "Vacature bewerken",
};

type EditVacancyPageProps = {
  params: Promise<{ vacancyId: string }>;
};

export default async function EditVacancyPage({ params }: EditVacancyPageProps) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    redirect(authRoutes.login);
  }

  const { vacancyId } = await params;
  const vacanciesService = await createVacanciesService();

  let vacancy;

  try {
    vacancy = await vacanciesService.getVacancy(context, toVacancyId(vacancyId));
  } catch (error) {
    if (error instanceof VacanciesValidationError) {
      notFound();
    }

    throw error;
  }

  const companies = await loadCompanyOptionsForUi(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacature bewerken"
        description={`Wijzig de gegevens van "${vacancy.title}".`}
      />
      <EditVacancyClient
        vacancyId={vacancyId}
        companies={companies}
        defaultValues={{
          companyId: vacancy.companyId as string,
          title: vacancy.title,
          description: vacancy.description ?? "",
          location: vacancy.location ?? "",
          employmentType: vacancy.employmentType,
          salaryMin: vacancy.salaryMin != null ? String(vacancy.salaryMin) : "",
          salaryMax: vacancy.salaryMax != null ? String(vacancy.salaryMax) : "",
          requirements: vacancy.requirements ?? "",
          status: vacancy.status,
        }}
      />
    </div>
  );
}
