import { NextResponse } from "next/server";
import { toVacancyId } from "@/features/vacancies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import { toCompanyId } from "@/features/companies/domain";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { serializeVacancy } from "@/lib/vacancies/format";
import { mapVacancyErrorToStatus } from "@/lib/vacancies/api-errors";
import { updateVacancyBodySchema } from "@/lib/validations/vacancies-api";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

type RouteContext = {
  params: Promise<{ vacancyId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const auth = await getAuthenticatedServiceContext();

  if (!auth) {
    return jsonError("Je bent niet ingelogd.", 401);
  }

  const { vacancyId } = await context.params;

  try {
    const vacanciesService = await createVacanciesService();
    const vacancy = await vacanciesService.getVacancy(auth, toVacancyId(vacancyId));

    const companiesService = await createCompaniesService();
    const company = await companiesService.getCompany(auth, vacancy.companyId);

    return NextResponse.json(
      {
        vacancy: serializeVacancy(vacancy),
        companyName: company.name,
      },
      { headers: JSON_HEADERS },
    );
  } catch (error) {
    const mapped = mapVacancyErrorToStatus(error);
    return jsonError(mapped.message, mapped.status);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const auth = await getAuthenticatedServiceContext();

  if (!auth) {
    return jsonError("Je bent niet ingelogd.", 401);
  }

  const { vacancyId } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Ongeldige JSON in het verzoek.", 400);
  }

  const parsed = updateVacancyBodySchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    return jsonError(message, 400);
  }

  try {
    const vacanciesService = await createVacanciesService();
    const vacancy = await vacanciesService.updateVacancy(
      auth,
      toVacancyId(vacancyId),
      {
        companyId: parsed.data.companyId
          ? toCompanyId(parsed.data.companyId)
          : undefined,
        title: parsed.data.title,
        ownerId: parsed.data.ownerId,
        description: parsed.data.description,
        location: parsed.data.location,
        employmentType: parsed.data.employmentType,
        salaryMin: parsed.data.salaryMin,
        salaryMax: parsed.data.salaryMax,
        status: parsed.data.status,
        requirements: parsed.data.requirements,
      },
    );

    return NextResponse.json(
      { vacancy: serializeVacancy(vacancy) },
      { headers: JSON_HEADERS },
    );
  } catch (error) {
    const mapped = mapVacancyErrorToStatus(error);
    return jsonError(mapped.message, mapped.status);
  }
}
