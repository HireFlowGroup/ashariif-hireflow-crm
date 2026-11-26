import { NextResponse } from "next/server";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { ProspectAuditRepository } from "@/features/ai-recruiter/repositories/prospect-audit.repository";
import { resolveQualificationThresholds } from "@/features/ai-recruiter/services/qualification-contract.service";
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
  const runRepository = await createAiRecruiterRepository();

  try {
    const [decisions, run] = await Promise.all([
      repository.listByRun(context.organizationId, runId),
      runRepository.getRun(context.organizationId, runId),
    ]);

    const qualificationPolicy = run
      ? resolveQualificationThresholds(run.searchCriteria)
      : null;

    return NextResponse.json({ decisions, qualificationPolicy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kon prospectbeslissingen niet laden" },
      { status: 500 },
    );
  }
}