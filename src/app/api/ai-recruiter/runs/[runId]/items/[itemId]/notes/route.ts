import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { toCompanyId } from "@/features/companies/domain";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ runId: string; itemId: string }> };

const itemIdSchema = z.string().uuid("Ongeldige itemId");
const bodySchema = z.object({
  notes: z.string().max(5000).nullable(),
});

export async function PATCH(request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { runId: rawRunId, itemId: rawItemId } = await routeContext.params;
  const runIdResult = aiRecruiterRunIdParamSchema.safeParse(rawRunId);
  const itemIdResult = itemIdSchema.safeParse(rawItemId);

  if (!runIdResult.success || !itemIdResult.success) {
    return NextResponse.json({ error: "Ongeldige parameters" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige body" }, { status: 400 });
  }

  try {
    const repository = await createAiRecruiterRepository();
    const item = await repository.getRunItem(context.organizationId, itemIdResult.data);

    if (!item || item.runId !== runIdResult.data) {
      return NextResponse.json({ error: "Prospect niet gevonden" }, { status: 404 });
    }

    if (!item.companyId) {
      return NextResponse.json({ error: "Geen bedrijf gekoppeld — notities kunnen niet worden opgeslagen." }, { status: 422 });
    }

    const client = await createClient();
    const companiesService = await createCompaniesServiceWithWriteClient(client);
    const updated = await companiesService.updateCompany(context, toCompanyId(item.companyId), {
      notes: parsed.data.notes,
    });

    return NextResponse.json({ notes: updated.notes });
  } catch (error) {
    console.error("[AI Recruiter] PATCH notes failed", { error });
    const message = error instanceof Error ? error.message : "Notities opslaan mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
