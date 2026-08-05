import { NextResponse } from "next/server";

import { listDiscoveryQueryRuns } from "@/features/company-finder/discovery/discovery-query-diagnostics.store";
import { getPipelineRuns } from "@/features/lead-intelligence/providers/manager";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export async function GET(request: Request) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const jobId = searchParams.get("jobId");

  let runs = getPipelineRuns(limit);

  if (jobId) {
    runs = runs.filter((run) => run.jobId === jobId);
  }

  const discoveryQueries = listDiscoveryQueryRuns(limit).filter(
    (entry) => !context.organizationId || entry.organizationId === context.organizationId,
  );

  return NextResponse.json({ runs, discoveryQueries });
}
