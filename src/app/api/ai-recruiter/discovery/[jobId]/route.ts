import { NextResponse } from "next/server";

import { getDiscoveryQueryRun } from "@/features/company-finder/discovery/discovery-query-diagnostics.store";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const auth = await getAuthenticatedServiceContext();
  if (!auth) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const run = getDiscoveryQueryRun(jobId);

  if (!run) {
    return NextResponse.json({ error: "Geen discovery-run gevonden" }, { status: 404 });
  }

  if (auth.organizationId && run.organizationId && run.organizationId !== auth.organizationId) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  return NextResponse.json({ discovery: run });
}
