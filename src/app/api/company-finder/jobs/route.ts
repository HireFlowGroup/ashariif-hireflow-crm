import { NextResponse } from "next/server";
import { createCompanyFinderService } from "@/features/company-finder/create-company-finder-service";
import { CompanySearchJobRepositoryError } from "@/features/company-finder/repositories/errors";
import { CompanyFinderServiceError } from "@/features/company-finder/services/errors";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";
import { createCompanySearchJobSchema } from "@/features/company-finder/validation";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

type ApiErrorBody = {
  success: false;
  code: string;
  message: string;
  details?: string;
};

function jsonError(
  code: string,
  message: string,
  status: number,
  details?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
      ...(details ? { details } : {}),
    },
    { status, headers: JSON_HEADERS },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return jsonError("UNAUTHORIZED", "Je bent niet ingelogd.", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Ongeldige JSON in het verzoek.", 400);
  }

  const parsed = createCompanySearchJobSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige zoekcriteria.";
    return jsonError("VALIDATION_ERROR", message, 400);
  }

  try {
    pipelineDebug("api.job.create.request", {
      userId: context.userId,
      organizationId: context.organizationId,
      body: parsed.data,
    });

    const finderService = await createCompanyFinderService();
    const job = await finderService.createJob(context, parsed.data);

    pipelineDebug("api.job.create.response", { jobId: job.id, status: job.status });

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: job.status,
      },
      { status: 201, headers: JSON_HEADERS },
    );
  } catch (error) {
    console.error("[api/company-finder/jobs] POST mislukt", {
      userId: context.userId,
      organizationId: context.organizationId,
      error: error instanceof Error ? error.message : "Onbekende fout",
      supabaseCode:
        error instanceof CompanySearchJobRepositoryError ? error.supabaseCode : undefined,
    });

    if (error instanceof CompanyFinderServiceError) {
      return jsonError("COMPANY_SEARCH_JOB_CREATE_FAILED", error.message, 422);
    }

    if (error instanceof CompanySearchJobRepositoryError) {
      return jsonError(
        "COMPANY_SEARCH_JOB_CREATE_FAILED",
        error.message,
        error.supabaseCode === "42501" ? 403 : 500,
        error.supabaseDetails,
      );
    }

    return jsonError(
      "COMPANY_SEARCH_JOB_CREATE_FAILED",
      "Zoekjob kon niet worden aangemaakt.",
      500,
    );
  }
}
