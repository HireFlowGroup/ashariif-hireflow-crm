import { NextResponse } from "next/server";
import { toCompanyId } from "@/features/companies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { serializeVacancy } from "@/lib/vacancies/format";
import { mapVacancyErrorToStatus } from "@/lib/vacancies/api-errors";
import {
  createVacancyBodySchema,
  listVacanciesQuerySchema,
} from "@/lib/validations/vacancies-api";
import { createCompaniesService } from "@/features/companies/create-companies-service";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

export async function GET(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return jsonError(
      "Je bent niet ingelogd. Log opnieuw in om vacatures te bekijken.",
      401,
    );
  }

  const url = new URL(request.url);
  const parsedQuery = listVacanciesQuerySchema.safeParse({
    query: url.searchParams.get("query") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    companyId: url.searchParams.get("companyId") ?? undefined,
    employmentType: url.searchParams.get("employmentType") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    includeArchived: url.searchParams.get("includeArchived") ?? undefined,
  });

  if (!parsedQuery.success) {
    const message = parsedQuery.error.issues[0]?.message ?? "Ongeldige queryparameters.";
    return jsonError(message, 400);
  }

  const { query, status, companyId, employmentType, limit, offset, includeArchived } =
    parsedQuery.data;

  try {
    const vacanciesService = await createVacanciesService();
    const companiesService = await createCompaniesService();

    const useSearch =
      Boolean(query?.trim()) ||
      Boolean(status) ||
      Boolean(employmentType) ||
      includeArchived === true;

    let vacancies;
    let total: number;

    if (useSearch) {
      vacancies = await vacanciesService.searchVacancies(context, {
        query: query?.trim() || undefined,
        companyId: companyId ? toCompanyId(companyId) : undefined,
        employmentType,
        status,
        archived: status === "closed" ? true : includeArchived ? undefined : false,
        limit,
      });
      total = vacancies.length;
    } else {
      const result = await vacanciesService.listVacancies(context, {
        limit,
        offset,
        includeArchived: includeArchived ?? false,
        companyId: companyId ? toCompanyId(companyId) : undefined,
      });
      vacancies = result.vacancies;
      total = result.total;
    }

    const { companies } = await companiesService.listCompanies(context, {
      limit: 100,
      includeArchived: false,
    });

    const companyNameById = new Map(
      companies.map((company) => [company.id as string, company.name]),
    );

    return NextResponse.json(
      {
        vacancies: vacancies.map((vacancy) => ({
          ...serializeVacancy(vacancy),
          companyName: companyNameById.get(vacancy.companyId as string) ?? "Onbekend bedrijf",
        })),
        total,
      },
      { headers: JSON_HEADERS },
    );
  } catch (error) {
    const mapped = mapVacancyErrorToStatus(error);
    return jsonError(mapped.message, mapped.status);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return jsonError(
      "Je bent niet ingelogd. Log opnieuw in om vacatures te beheren.",
      401,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Ongeldige JSON in het verzoek.", 400);
  }

  const parsed = createVacancyBodySchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    return jsonError(message, 400);
  }

  try {
    const vacanciesService = await createVacanciesService();
    const vacancy = await vacanciesService.createVacancy(context, {
      companyId: toCompanyId(parsed.data.companyId),
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      employmentType: parsed.data.employmentType,
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      status: parsed.data.status,
      requirements: parsed.data.requirements ?? null,
    });

    return NextResponse.json(
      { vacancy: serializeVacancy(vacancy) },
      { status: 201, headers: JSON_HEADERS },
    );
  } catch (error) {
    const mapped = mapVacancyErrorToStatus(error);
    return jsonError(mapped.message, mapped.status);
  }
}
