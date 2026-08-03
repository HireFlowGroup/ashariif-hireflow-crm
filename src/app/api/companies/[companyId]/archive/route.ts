import { NextResponse } from "next/server";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import { toCompanyId } from "@/features/companies/domain";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(
  request: Request,
  contextParams: { params: Promise<{ companyId: string }> },
): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Je bent niet ingelogd." }, { status: 401, headers: JSON_HEADERS });
  }

  const { companyId } = await contextParams.params;

  let body: { reason?: string } = {};

  try {
    body = (await request.json()) as { reason?: string };
  } catch {
    body = {};
  }

  try {
    const companiesService = await createCompaniesService();
    await companiesService.archiveCompany(context, toCompanyId(companyId), {
      reason: body.reason,
    });

    return NextResponse.json({ success: true }, { headers: JSON_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archiveren mislukt.";
    return NextResponse.json({ error: message }, { status: 400, headers: JSON_HEADERS });
  }
}
