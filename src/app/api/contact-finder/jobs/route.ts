import { NextResponse } from "next/server";
import { createContactFinderService } from "@/features/contact-finder/create-contact-finder-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createContactSearchJobSchema } from "@/features/contact-finder/validation";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return jsonError("Je bent niet ingelogd.", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Ongeldige JSON in het verzoek.", 400);
  }

  const parsed = createContactSearchJobSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige zoekcriteria.";
    return jsonError(message, 400);
  }

  try {
    const finderService = await createContactFinderService();
    const job = await finderService.createJob(context, parsed.data);

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        companyId: job.companyId,
      },
      { status: 201, headers: JSON_HEADERS },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Zoekjob kon niet worden gestart.";
    return jsonError(message, 500);
  }
}
