import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import { OutreachQueueService } from "@/features/outreach/services/outreach-queue.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { toCompanyId } from "@/features/companies/domain";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(
  _request: Request,
  contextParams: { params: Promise<{ companyId: string }> },
): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Je bent niet ingelogd." }, { status: 401, headers: JSON_HEADERS });
  }

  const { companyId } = await contextParams.params;

  try {
    const companiesService = await createCompaniesService();
    const company = await companiesService.getCompany(context, toCompanyId(companyId));
    const client = await createClient();
    const outreachService = new OutreachQueueService(client);
    const item = await outreachService.queueCompany(
      context.organizationId,
      context.userId,
      company,
    );

    return NextResponse.json({ queueItemId: item.id, status: item.status }, { status: 201, headers: JSON_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outreach kon niet worden voorbereid.";
    return NextResponse.json({ error: message }, { status: 400, headers: JSON_HEADERS });
  }
}
