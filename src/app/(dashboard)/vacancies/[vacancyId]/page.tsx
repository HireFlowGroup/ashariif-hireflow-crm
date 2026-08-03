import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { VacancyStatusBadge } from "@/components/vacancies/vacancy-status-badge";
import { VacancyDetailActions } from "@/components/vacancies/vacancy-detail-actions";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import { toVacancyId } from "@/features/vacancies/domain";
import { VacanciesValidationError } from "@/features/vacancies/services/errors";
import {
  formatDateTimeNl,
  formatEmploymentType,
  formatSalaryRange,
} from "@/lib/vacancies/format";
import { authRoutes } from "@/config/navigation";

export const metadata: Metadata = {
  title: "Vacature",
};

type VacancyDetailPageProps = {
  params: Promise<{ vacancyId: string }>;
};

export default async function VacancyDetailPage({ params }: VacancyDetailPageProps) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    redirect(authRoutes.login);
  }

  const { vacancyId } = await params;

  const vacanciesService = await createVacanciesService();
  const companiesService = await createCompaniesService();

  let vacancy;
  let companyName: string;

  try {
    vacancy = await vacanciesService.getVacancy(context, toVacancyId(vacancyId));
    const company = await companiesService.getCompany(context, vacancy.companyId);
    companyName = company.name;
  } catch (error) {
    if (error instanceof VacanciesValidationError) {
      notFound();
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={vacancy.title}
        description={`Vacature bij ${companyName}`}
        actions={
          <VacancyDetailActions
            vacancyId={vacancyId}
            vacancyTitle={vacancy.title}
            isClosed={vacancy.status === "closed"}
          />
        }
      />

      <div className="grid gap-6 rounded-xl border bg-card p-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Bedrijf</p>
            <p className="font-medium">{companyName}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Status</p>
            <VacancyStatusBadge status={vacancy.status} className="mt-1" />
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Locatie</p>
            <p>{vacancy.location ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Dienstverband</p>
            <p>{formatEmploymentType(vacancy.employmentType)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Salaris</p>
            <p>{formatSalaryRange(vacancy.salaryMin, vacancy.salaryMax)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Aangemaakt</p>
            <p className="text-sm text-muted-foreground">
              {formatDateTimeNl(vacancy.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Laatst bijgewerkt</p>
            <p className="text-sm text-muted-foreground">
              {formatDateTimeNl(vacancy.updatedAt)}
            </p>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="text-sm font-semibold">Omschrijving</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {vacancy.description?.trim() || "Geen omschrijving opgegeven."}
            </p>
          </section>
          <section>
            <h2 className="text-sm font-semibold">Vereisten</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {vacancy.requirements?.trim() || "Geen vereisten opgegeven."}
            </p>
          </section>
        </div>
      </div>

      <Link
        href="/vacancies"
        className={cn(buttonVariants({ variant: "link" }), "px-0")}
      >
        ← Terug naar overzicht
      </Link>
    </div>
  );
}
