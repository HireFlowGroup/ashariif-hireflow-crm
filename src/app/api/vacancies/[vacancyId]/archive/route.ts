import { NextResponse } from "next/server";
import { toVacancyId } from "@/features/vacancies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { serializeVacancy } from "@/lib/vacancies/format";
import { mapVacancyErrorToStatus } from "@/lib/vacancies/api-errors";
import { archiveVacancyBodySchema } from "@/lib/validations/vacancies-api";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

type RouteContext = {
  params: Promise<{ vacancyId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const auth = await getAuthenticatedServiceContext();

  if (!auth) {
    return jsonError("Je bent niet ingelogd.", 401);
  }

  const { vacancyId } = await context.params;

  let body: unknown = {};

  try {
    if (request.headers.get("content-length") !== "0") {
      body = await request.json();
    }
  } catch {
    return jsonError("Ongeldige JSON in het verzoek.", 400);
  }

  const parsed = archiveVacancyBodySchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    return jsonError(message, 400);
  }

  try {
    const vacanciesService = await createVacanciesService();
    const vacancy = await vacanciesService.archiveVacancy(
      auth,
      toVacancyId(vacancyId),
      { reason: parsed.data.reason },
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
