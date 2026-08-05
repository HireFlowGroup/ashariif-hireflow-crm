import { NextResponse } from "next/server";

import { ProspectAuditRepository } from "@/features/ai-recruiter/repositories/prospect-audit.repository";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { runId } = await params;
  const client = await createClient();
  const repository = new ProspectAuditRepository(client);

  try {
    const decisions = await repository.listByRun(context.organizationId, runId);
    return NextResponse.json({ decisions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kon prospectbeslissingen niet laden" },
      { status: 500 },
    );
  }
}
