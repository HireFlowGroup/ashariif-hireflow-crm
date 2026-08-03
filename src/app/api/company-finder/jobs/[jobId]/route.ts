import { NextResponse } from "next/server";
import { createCompanyFinderService } from "@/features/company-finder/create-company-finder-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(
  _request: Request,
  contextParams: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Je bent niet ingelogd." }, { status: 401, headers: JSON_HEADERS });
  }

  const { jobId } = await contextParams.params;

  try {
    const finderService = await createCompanyFinderService();
    const job = await finderService.getJob(context, jobId);

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        criteria: job.criteria,
        foundCount: job.foundCount,
        savedCount: job.savedCount,
        updatedCount: job.updatedCount,
        skippedCount: job.skippedCount,
        errorCount: job.errorCount,
        providerErrors: job.providerErrors,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      { headers: JSON_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job kon niet worden opgehaald.";
    return NextResponse.json({ error: message }, { status: 404, headers: JSON_HEADERS });
  }
}
